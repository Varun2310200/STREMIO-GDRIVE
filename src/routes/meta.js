// src/routes/meta.js
const helpers = require("../utils/helpers");
const gdrive = require("../utils/gdriveApi");

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function listFilesInFolder(folderId) {
  const q = `'${folderId}' in parents and trashed=false and (mimeType='${FOLDER_MIME}' or mimeType contains 'video/')`;
  const url = new URL(gdrive.API.DRIVE_FILES);
  const params = {
    q,
    corpora: "allDrives",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    pageSize: "1000",
    fields: "files(id,name,mimeType,thumbnailLink,createdTime,size,iconLink)"
  };
  url.search = new URLSearchParams(params).toString();
  const r = await gdrive.withSaFetch(url.toString());
  if (!r.ok) return null;
  return r.json();
}

function detectSeasonNumber(name) {
  const patterns = [/season[\s\_\-]?(\d+)/i, /(\d+)(?:st|nd|rd|th)[\s\_\-]season/i, /season[\s\_\-](\d+)/i];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

async function collectVideosRecursive(files, seasonNum, folderIcon) {
  let videos = [];
  const folders = files.filter(f => f.mimeType === "application/vnd.google-apps.folder");
  const videosOnly = files.filter(f => f.mimeType && f.mimeType.startsWith("video/"));

  if (videosOnly.length > 0) {
    videosOnly.forEach(videoFile => {
      videos.push({
        id: `gdrive:${videoFile.id}`,
        title: videoFile.name,
        season: seasonNum !== null ? seasonNum : 1,
        episode: videos.filter(v => v.season === (seasonNum !== null ? seasonNum : 1)).length + 1,
        released: videoFile.createdTime,
        overview: `Size: ${videoFile.size ? helpers.fmtSize(parseInt(videoFile.size)) : "Unknown"}`,
        thumbnail: videoFile.thumbnailLink || folderIcon
      });
    });
  }

  if (folders.length > 0) {
    const folderPromises = folders.map(async folder => {
      let season = detectSeasonNumber(folder.name);
      if (season === null) season = 1;
      const res = await listFilesInFolder(folder.id);
      const subFiles = (res?.files) || [];
      return await collectVideosRecursive(subFiles, season, folder.iconLink || folderIcon);
    });
    const subVideoArrays = await Promise.all(folderPromises);
    subVideoArrays.forEach(sub => (videos = videos.concat(sub)));
  }

  videos = videos.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
  });

  let seasonEpisodes = {};
  for (const v of videos) {
    if (!seasonEpisodes[v.season]) seasonEpisodes[v.season] = 1;
    v.episode = seasonEpisodes[v.season]++;
  }
  return videos;
}

module.exports = (app) => {
  app.get("/meta/:type/:id.json", async (req, res) => {
    const CONFIG = app.locals.CONFIG;
    const SERVICE_ACCOUNTS = app.locals.SERVICE_ACCOUNTS || [];
    gdrive.init(CONFIG, SERVICE_ACCOUNTS);
    res.set({ "Access-Control-Allow-Origin": "*" });

    try {
      const idRaw = decodeURIComponent(req.params.id);
      if (idRaw.startsWith("gdrive:")) {
        const fileId = idRaw.split(":")[1];
        const r = await gdrive.withSaFetch(gdrive.API.DRIVE_FILE(fileId, "id,name,thumbnailLink,size,createdTime"));
        if (!r.ok) return res.status(200).send({ meta: null });
        const f = await r.json();
        const metaObj = {
          id: `gdrive:${fileId}`,
          type: "movie",
          name: f.name,
          poster: f.thumbnailLink || null,
          background: f.thumbnailLink || null,
          description: `Size: ${f.size ? helpers.fmtSize(parseInt(f.size)) : "Unknown"}`
        };
        if (CONFIG.enableDownloads) {
          metaObj.downloadInfo = { available: true, infoUrl: `${CONFIG.baseUrl}download-info/${fileId}.json`, size: parseInt(f.size || 0), formattedSize: helpers.fmtSize(parseInt(f.size || 0)) };
        }
        return res.status(200).send({ meta: metaObj });
      }

      if (idRaw.startsWith("gdrive-folder:")) {
        const folderId = idRaw.split(":")[1];
        const folderRes = await gdrive.withSaFetch(gdrive.API.DRIVE_FILE(folderId, "id,name,iconLink"));
        if (!folderRes.ok) return res.status(200).send({ meta: null });
        const folder = await folderRes.json();
        const resList = await listFilesInFolder(folderId);
        const videos = await collectVideosRecursive(resList?.files || [], null, folder.iconLink);
        return res.status(200).send({ meta: { id: `gdrive-folder:${folderId}`, type: "series", name: folder.name, poster: "https://cdn-icons-png.flaticon.com/512/716/716784.png", background: null, description: "📂 Google Drive Folder", videos }});
      }

      return res.status(200).send({ meta: null });
    } catch (err) {
      console.error("Meta handler error:", err);
      return res.status(200).send({ meta: null });
    }
  });
};
