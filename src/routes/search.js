// src/routes/search.js
const { extractCleanTitle, normalizeSearchQuery, tokenizeQuery } = require("../utils/helpers");
const gdrive = require("../utils/gdriveApi");

function calculateSearchScore(fileName, searchTokens) {
  const name = fileName.toLowerCase();
  let score = 0, matches = 0;
  for (const token of searchTokens) {
    if (name.includes(token)) {
      matches++;
      if (name.startsWith(token)) score += 0.5;
      else if (name.includes(`.${token}`) || name.includes(` ${token}`)) score += 0.3;
      else score += 0.2;
    }
  }
  if (matches === searchTokens.length) score += 0.5;
  return Math.min(1, score / searchTokens.length);
}

module.exports = (app) => {
  app.get("/search/:q.json", async (req, res) => {
    const CONFIG = app.locals.CONFIG;
    const SERVICE_ACCOUNTS = app.locals.SERVICE_ACCOUNTS || [];
    gdrive.init(CONFIG, SERVICE_ACCOUNTS);

    res.set({ "Access-Control-Allow-Origin": "*" });

    const q = decodeURIComponent(req.params.q || "");
    if (!q || q.length < 3) return res.status(200).send({ metas: [] });

    try {
      const normalized = normalizeSearchQuery(q);
      const tokens = tokenizeQuery(normalized);
      if (!tokens.length) return res.status(200).send({ metas: [] });

      const queryParams = {
        q: `name contains '${q.replace(/'/g, "\\'")}' and trashed=false and not name contains 'trailer' and not name contains 'sample' and (mimeType contains 'video/' or mimeType='application/vnd.google-apps.folder')`,
        corpora: "allDrives",
        includeItemsFromAllDrives: "true",
        supportsAllDrives: "true",
        pageSize: "1000",
        fields: "files(id,name,size,videoMediaMetadata,mimeType,fileExtension,thumbnailLink,createdTime)"
      };
      const url = new URL(gdrive.API.DRIVE_FILES);
      Object.keys(queryParams).forEach(k => queryParams[k] = String(queryParams[k]));
      url.search = new URLSearchParams(queryParams).toString();
      const r = await gdrive.withSaFetch(url.toString());
      if (!r.ok) throw new Error(`Drive search failed ${r.status}`);
      const j = await r.json();
      const files = j.files || [];
      const results = files.map(f => {
        const cleanTitle = extractCleanTitle(f.name);
        const score = calculateSearchScore(cleanTitle, tokens);
        return {
          id: f.mimeType === "application/vnd.google-apps.folder" ? `gdrive-folder:${f.id}` : `gdrive:${f.id}`,
          name: f.name,
          type: f.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file",
          score,
          thumbnail: f.thumbnailLink
        };
      }).filter(r => r.score >= 0.3).slice(0,200);

      const metas = results.map(result => ({
        id: result.id,
        type: "movie",
        name: result.name,
        poster: result.thumbnail || (result.type === "folder" ? "https://cdn-icons-png.flaticon.com/512/716/716784.png" : null),
        description: result.type === "folder" ? "📂 Folder" : `Size: ${result.size ? result.size : "Unknown"}`
      }));

      res.status(200).send({ metas });
    } catch (e) {
      console.error("Search error:", e);
      res.status(200).send({ metas: [] });
    }
  });
};
