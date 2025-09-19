// src/routes/catalog.js
const helpers = require("../utils/helpers");
const gdrive = require("../utils/gdriveApi");

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS,POST",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "public, max-age=300"
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

function normalizeSearch(s) {
  return s.replace(/[\._\-\s]+/g, " ").trim().toLowerCase();
}

module.exports = (app) => {
  app.get("/catalog/:type/:catId(.+?)(?:/search=([^/]+))?.json", async (req, res) => {
    const CONFIG = app.locals.CONFIG;
    const SERVICE_ACCOUNTS = app.locals.SERVICE_ACCOUNTS || [];
    gdrive.init(CONFIG, SERVICE_ACCOUNTS);
    res.set(HEADERS);

    try {
      const type = decodeURIComponent(req.params.type);
      const catIdRaw = decodeURIComponent(req.params.catId);
      const search = req.params.search ? decodeURIComponent(req.params.search) : null;

      // gdrive-hindi-dubbed and gdrive-web-series accept folderId:page but we'll use pageToken cursor
      if (catIdRaw.startsWith("gdrive-hindi-dubbed:") || catIdRaw.startsWith("gdrive-web-series:")) {
        const parts = catIdRaw.split(":");
        const folderId = parts[1];
        // client may pass pageToken query param base64url-encoded
        const incomingPageToken = req.query.pageToken ? Buffer.from(req.query.pageToken, "base64url").toString("utf8") : null;
        const itemsPerPage = CONFIG.itemsPerCatalogPage || 50;
        const params = {
          q: `'${folderId}' in parents and trashed=false and (mimeType='${FOLDER_MIME}' or mimeType contains 'video/')`,
          corpora: "allDrives",
          includeItemsFromAllDrives: "true",
          supportsAllDrives: "true",
          pageSize: String(itemsPerPage),
          fields: "nextPageToken,files(id,name,mimeType,thumbnailLink,size,createdTime,iconLink)",
        };
        if (incomingPageToken) params.pageToken = incomingPageToken;
        const url = new URL(gdrive.API.DRIVE_FILES);
        url.search = new URLSearchParams(params).toString();
        const r = await gdrive.withSaFetch(url.toString());
        if (!r.ok) return res.status(200).send({ metas: [], hasMore: false });
        const j = await r.json();
        const files = j.files || [];
        const folders = files.filter(f => f.mimeType === FOLDER_MIME);
        const vids = files.filter(f => f.mimeType !== FOLDER_MIME);
        let metas = [
          ...folders.map(f => ({ id: `gdrive-folder:${f.id}`, type: "movie", name: f.name, poster: "https://cdn-icons-png.flaticon.com/512/716/716784.png", description: "📂 Folder" })),
          ...vids.map(f => ({ id: `gdrive:${f.id}`, type: "movie", name: f.name, poster: f.thumbnailLink || null, description: "Size: " + (f.size ? helpers.fmtSize(parseInt(f.size)) : "Unknown") }))
        ];
        const nextToken = j.nextPageToken ? Buffer.from(j.nextPageToken, "utf8").toString("base64url") : null;
        const hasMore = !!j.nextPageToken;
        if (search) {
          const norm = normalizeSearch(search);
          metas = metas.filter(m => m.name && normalizeSearch(m.name).includes(norm));
        }
        return res.status(200).send({ metas, hasMore, nextPageToken: nextToken });
      }

      // full list catalog (gdrive_list)
      if (catIdRaw === "gdrive_list") {
        const params = {
          q: "mimeType contains 'video/' and trashed=false",
          corpora: "allDrives",
          includeItemsFromAllDrives: "true",
          supportsAllDrives: "true",
          pageSize: "100",
          orderBy: "createdTime desc",
          fields: "nextPageToken,incompleteSearch,files(id,name,size,videoMediaMetadata,mimeType,fileExtension,thumbnailLink,createdTime)"
        };
        const url = new URL(gdrive.API.DRIVE_FILES);
        url.search = new URLSearchParams(params).toString();
        const r = await gdrive.withSaFetch(url.toString());
        if (!r.ok) return res.status(200).send({ metas: [], hasMore: false });
        const results = await r.json();
        const metasOut = (results.files || []).map(file => ({
          id: `gdrive:${file.id}`,
          name: file.name,
          posterShape: "landscape",
          background: file.thumbnailLink,
          poster: file.thumbnailLink,
          description: `Size: ${helpers.fmtSize(file.size)}${file.createdTime ? ` | Created: ${new Date(file.createdTime).toLocaleDateString()}` : ""}`,
          type: "movie"
        }));
        const hasMore = !!results.nextPageToken;
        return res.status(200).send({ metas: metasOut, hasMore });
      }

      // search param on catalog
      if (search) {
        const qstr = search.replace(/'/g, "\\'");
        const params = {
          q: `name contains '${qstr}' and trashed=false and not name contains 'trailer' and not name contains 'sample' and (mimeType contains 'video/' or mimeType='${FOLDER_MIME}')`,
          corpora: "allDrives",
          includeItemsFromAllDrives: "true",
          supportsAllDrives: "true",
          pageSize: "1000",
          fields: "files(id,name,size,mimeType,thumbnailLink,createdTime)"
        };
        const url = new URL(gdrive.API.DRIVE_FILES);
        url.search = new URLSearchParams(params).toString();
        const r = await gdrive.withSaFetch(url.toString());
        if (!r.ok) return res.status(200).send({ metas: [], hasMore: false });
        const j = await r.json();
        const metas = (j.files || []).map(f => ({
          id: f.mimeType === FOLDER_MIME ? `gdrive-folder:${f.id}` : `gdrive:${f.id}`,
          type: "movie",
          name: f.name,
          poster: f.thumbnailLink || (f.mimeType === FOLDER_MIME ? "https://cdn-icons-png.flaticon.com/512/716/716784.png" : null),
          description: f.mimeType === FOLDER_MIME ? "📂 Folder" : `Size: ${f.size ? helpers.fmtSize(parseInt(f.size)) : "Unknown"}`
        }));
        return res.status(200).send({ metas, hasMore: false });
      }

      // root folder listing
      if (catIdRaw.startsWith("gdrive-root:") || catIdRaw.startsWith("gdrive-folder:")) {
        const folderId = catIdRaw.split(":")[1];
        const params = {
          q: `'${folderId}' in parents and trashed=false and (mimeType='${FOLDER_MIME}' or mimeType contains 'video/')`,
          corpora: "allDrives",
          includeItemsFromAllDrives: "true",
          supportsAllDrives: "true",
          pageSize: CONFIG.pageSize || "100",
          fields: "files(id,name,mimeType,thumbnailLink,createdTime,size,iconLink)",
          orderBy: "name"
        };
        const url = new URL(gdrive.API.DRIVE_FILES);
        url.search = new URLSearchParams(params).toString();
        const r = await gdrive.withSaFetch(url.toString());
        if (!r.ok) return res.status(200).send({ metas: [], hasMore: false });
        const j = await r.json();
        const files = j.files || [];
        const folders = files.filter(f => f.mimeType === FOLDER_MIME);
        const vids = files.filter(f => f.mimeType !== FOLDER_MIME);
        const metas = [
          ...folders.map(f => ({ id: `gdrive-folder:${f.id}`, type: "movie", name: f.name, poster: "https://cdn-icons-png.flaticon.com/512/716/716784.png", description: "📂 Subfolder" })),
          ...vids.map(f => ({ id: `gdrive:${f.id}`, type: "movie", name: f.name, poster: f.thumbnailLink || null, description: "Size: " + (f.size ? helpers.fmtSize(parseInt(f.size)) : "Unknown") }))
        ];
        return res.status(200).send({ metas, hasMore: false });
      }

      return res.status(200).send({ metas: [], hasMore: false });
    } catch (err) {
      console.error("Catalog error:", err);
      return res.status(200).send({ metas: [], hasMore: false });
    }
  });
};
