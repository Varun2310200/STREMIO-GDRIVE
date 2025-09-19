// src/routes/stream.js
const helpers = require("../utils/helpers");
const gdrive = require("../utils/gdriveApi");

async function addSubtitles(stream, fileId) {
  const pfRes = await gdrive.withSaFetch(gdrive.API.DRIVE_FILE(fileId, "parents"));
  if (!pfRes.ok) return stream;
  const pf = await pfRes.json();
  const pid = pf?.parents?.[0];
  if (!pid) return stream;
  const params = {
    q: `'${pid}' in parents and trashed=false and (mimeType='text/vtt' or mimeType='application/x-subrip')`,
    corpora: "allDrives",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    pageSize: "100",
    fields: "files(id,name,mimeType)"
  };
  const url = new URL(gdrive.API.DRIVE_FILES);
  url.search = new URLSearchParams(params).toString();
  const r = await gdrive.withSaFetch(url.toString());
  if (!r.ok) return stream;
  const j = await r.json();
  const subs = (j.files || []).map(s => ({ url: `${gdrive.API.DRIVE_MEDIA(s.id)}`, lang: (s.name.match(/\.([a-z]{2}(?:-[A-Z]{2})?)\.(srt|vtt)$/i)?.[1]) || "en", name: s.name }));
  if (subs.length) stream.subtitles = subs;
  return stream;
}

function buildStreamObj(file, accessToken, baseUrl) {
  const directUrl = gdrive.API.DRIVE_MEDIA(file.id);
  return {
    name: "Google Drive",
    title: file.name,
    description: `📄 ${file.name}\n📦 ${file.size ? helpers.fmtSize(parseInt(file.size)) : "Unknown"}`,
    url: directUrl,
    behaviorHints: {
      videoSize: parseInt(file.size) || 0,
      filename: file.name,
      notWebReady: true,
      bingeGroup: `gdrive-${file.id}`,
      proxyHeaders: {
        request: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  };
}

module.exports = (app) => {
  app.get("/stream/:type/:id.json", async (req, res) => {
    const CONFIG = app.locals.CONFIG;
    const SERVICE_ACCOUNTS = app.locals.SERVICE_ACCOUNTS || [];
    gdrive.init(CONFIG, SERVICE_ACCOUNTS);

    res.set({ "Access-Control-Allow-Origin": "*" });

    try {
      const idRaw = decodeURIComponent(req.params.id);

      if (idRaw.startsWith("gdrive:")) {
        const fileId = idRaw.split(":")[1];
        const fRes = await gdrive.withSaFetch(gdrive.API.DRIVE_FILE(fileId, "id,name,size"));
        if (!fRes.ok) return res.status(200).send({ streams: [] });
        const f = await fRes.json();
        const accessToken = await gdrive.saAccessToken();
        let stream = buildStreamObj(f, accessToken, CONFIG.baseUrl);
        stream = await addSubtitles(stream, fileId);
        if (CONFIG.enableDownloads) {
          stream.downloadInfo = { available: true, infoUrl: `${CONFIG.baseUrl}download-info/${fileId}.json`, size: parseInt(f.size || 0), formattedSize: helpers.fmtSize(parseInt(f.size || 0)) };
        }
        return res.status(200).send({ streams: [stream] });
      }

      if (idRaw.startsWith("gdrive-folder:")) {
        const folderId = idRaw.split(":")[1];
        const params = {
          q: `'${folderId}' in parents and trashed=false and (mimeType contains 'video/' or mimeType='application/vnd.google-apps.folder')`,
          corpora: "allDrives",
          includeItemsFromAllDrives: "true",
          supportsAllDrives: "true",
          pageSize: "1000",
          fields: "files(id,name,mimeType,size,thumbnailLink,createdTime)"
        };
        const url = new URL(gdrive.API.DRIVE_FILES);
        url.search = new URLSearchParams(params).toString();
        const r = await gdrive.withSaFetch(url.toString());
        if (!r.ok) return res.status(200).send({ streams: [] });
        const j = await r.json();
        const videos = (j.files || []).filter(f => f.mimeType && f.mimeType.startsWith("video/"));
        if (!videos.length) return res.status(200).send({ streams: [] });
        const first = videos[0];
        const fRes = await gdrive.withSaFetch(gdrive.API.DRIVE_FILE(first.id, "id,name,size"));
        if (!fRes.ok) return res.status(200).send({ streams: [] });
        const f = await fRes.json();
        const accessToken = await gdrive.saAccessToken();
        let stream = buildStreamObj(f, accessToken, CONFIG.baseUrl);
        stream = await addSubtitles(stream, first.id);
        if (CONFIG.enableDownloads) {
          stream.downloadInfo = { available: true, infoUrl: `${CONFIG.baseUrl}download-info/${first.id}.json`, size: parseInt(f.size || 0), formattedSize: helpers.fmtSize(parseInt(f.size || 0)) };
        }
        return res.status(200).send({ streams: [stream] });
      }

      return res.status(200).send({ streams: [] });
    } catch (err) {
      console.error("Stream handler error:", err);
      return res.status(200).send({ streams: [] });
    }
  });
};
