// src/routes/download.js
const gdrive = require("../utils/gdriveApi");
const helpers = require("../utils/helpers");
const fetch = require("node-fetch");

function b64urlEncodeFromStr(s) {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function generateDownloadToken(fileId, fileName, fileSize, ttl = 3600) {
  const tokenData = {
    fileId,
    fileName,
    fileSize,
    exp: Date.now() + ttl * 1000,
    iat: Date.now()
  };
  const token = Buffer.from(JSON.stringify(tokenData)).toString("base64");
  return b64urlEncodeFromStr(token);
}

function validateDownloadToken(token, fileId) {
  try {
    const decoded = Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const tokenData = JSON.parse(decoded);
    if (tokenData.exp < Date.now()) return { valid: false, reason: "Token expired" };
    if (tokenData.fileId !== fileId) return { valid: false, reason: "Token file mismatch" };
    return { valid: true, data: tokenData };
  } catch (e) {
    return { valid: false, reason: "Invalid token" };
  }
}

module.exports = (app) => {
  app.get("/download-info/:id.json", async (req, res) => {
    const CONFIG = app.locals.CONFIG;
    const SERVICE_ACCOUNTS = app.locals.SERVICE_ACCOUNTS || [];
    gdrive.init(CONFIG, SERVICE_ACCOUNTS);

    res.set({ "Access-Control-Allow-Origin": "*" });

    try {
      const fileId = decodeURIComponent(req.params.id);
      const r = await gdrive.withSaFetch(gdrive.API.DRIVE_FILE(fileId, "id,name,size,mimeType,thumbnailLink"));
      if (!r.ok) return res.status(404).send({ error: "File not found" });
      const fileInfo = await r.json();
      const fileSize = parseInt(fileInfo.size || 0);
      if (fileSize > CONFIG.maxDownloadSize) return res.status(413).send({ error: "File too large", maxSize: CONFIG.maxDownloadSize, fileSize });
      const downloadToken = generateDownloadToken(fileInfo.id, fileInfo.name, fileInfo.size, CONFIG.downloadTokenExpiry || 3600);
      return res.status(200).send({
        id: fileInfo.id,
        name: fileInfo.name,
        size: fileSize,
        formattedSize: helpers.fmtSize(fileSize),
        mimeType: fileInfo.mimeType,
        thumbnail: fileInfo.thumbnailLink,
        downloadUrl: `${CONFIG.baseUrl}download/${fileInfo.id}?token=${downloadToken}`,
        directUrl: `${gdrive.API.DRIVE_MEDIA(fileInfo.id)}`,
        supportsResume: true,
        supportsChunked: fileSize > 10485760
      });
    } catch (err) {
      console.error("Download info error:", err);
      return res.status(500).send({ error: "Failed to get download info" });
    }
  });

  app.get("/download/:id", async (req, res) => {
    const CONFIG = app.locals.CONFIG;
    const SERVICE_ACCOUNTS = app.locals.SERVICE_ACCOUNTS || [];
    gdrive.init(CONFIG, SERVICE_ACCOUNTS);

    try {
      const fileId = decodeURIComponent(req.params.id);
      const token = req.query.token;
      if (!token) return res.status(401).send("Download token required");
      const tokenValidation = validateDownloadToken(token, fileId);
      if (!tokenValidation.valid) return res.status(403).send(`Invalid download token: ${tokenValidation.reason}`);
      const tokenData = tokenValidation.data;
      const accessToken = await gdrive.saAccessToken();
      const driveUrl = gdrive.API.DRIVE_MEDIA(fileId);
      const range = req.headers.range;
      const headers = { Authorization: `Bearer ${accessToken}`, ...(range ? { Range: range } : {}) };
      const driveRes = await fetch(driveUrl, { headers });
      if (!driveRes.ok) return res.status(driveRes.status).send(`Google Drive error: ${driveRes.status}`);
      res.set("Content-Disposition", `attachment; filename="${encodeURIComponent(tokenData.fileName)}"`);
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Expose-Headers", "*");
      if (range && driveRes.status === 206) {
        const contentRange = driveRes.headers.get("content-range");
        if (contentRange) res.set("Content-Range", contentRange);
        res.status(206);
      } else {
        res.status(driveRes.status);
      }
      driveRes.body.pipe(res);
    } catch (err) {
      console.error("Download error:", err);
      res.status(500).send("Download failed");
    }
  });
};
