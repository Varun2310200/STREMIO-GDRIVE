// src/routes/playback.js
const gdrive = require("../utils/gdriveApi");
const fetch = require("node-fetch");

module.exports = (app) => {
  app.get("/playback/:id", async (req, res) => {
    const CONFIG = app.locals.CONFIG;
    const SERVICE_ACCOUNTS = app.locals.SERVICE_ACCOUNTS || [];
    gdrive.init(CONFIG, SERVICE_ACCOUNTS);

    try {
      const idRaw = decodeURIComponent(req.params.id);
      const accessToken = await gdrive.saAccessToken();
      const driveUrl = gdrive.API.DRIVE_MEDIA(idRaw);

      if (!CONFIG.proxiedPlayback) {
        return res.redirect(302, `${driveUrl}&access_token=${accessToken}`);
      }

      // Proxy playback: stream bytes
      const range = req.headers["range"];
      const headers = { Authorization: `Bearer ${accessToken}`, ...(range ? { Range: range } : {}) };
      const driveRes = await fetch(driveUrl, { headers });
      if (!driveRes.ok) return res.status(driveRes.status).send("Drive playback error");
      const status = driveRes.status;
      const responseHeaders = {};
      driveRes.headers.forEach((v, k) => (responseHeaders[k] = v));
      responseHeaders["Access-Control-Allow-Origin"] = "*";
      responseHeaders["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS";
      responseHeaders["Access-Control-Allow-Headers"] = "*";
      res.status(status);
      for (const [k, v] of Object.entries(responseHeaders)) res.set(k, v);
      driveRes.body.pipe(res);
    } catch (err) {
      console.error("Playback error:", err);
      res.status(500).send("Playback failed");
    }
  });
};
