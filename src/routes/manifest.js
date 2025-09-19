// src/routes/manifest.js
module.exports = (app) => {
  app.get("/manifest.json", async (req, res) => {
    try {
      const CONFIG = app.locals.CONFIG;
      // safe defaults if counts aren't known yet
      const hindiDubbedCount = 1;
      const webSeriesCount = 1;
      const itemsPerPage = CONFIG.itemsPerCatalogPage || 50;
      const hindiPages = Math.ceil(hindiDubbedCount / itemsPerPage) || 1;
      const webPages = Math.ceil(webSeriesCount / itemsPerPage) || 1;
      const hindiDubbedCatalogs = [];
      for (let i = 1; i <= hindiPages; i++) hindiDubbedCatalogs.push({ type: "movie", id: `gdrive-hindi-dubbed:${CONFIG.hindiDubbedFolderId}:${i}`, name: `Hindi Dubbed-${i}` });
      const webSeriesCatalogs = [];
      for (let i = 1; i <= webPages; i++) webSeriesCatalogs.push({ type: "movie", id: `gdrive-web-series:${CONFIG.webSeriesFolderId}:${i}`, name: `Web Series-${i}` });
      const rootCatalogs = (CONFIG.rootFolders || []).filter((f) => f.id !== CONFIG.hindiDubbedFolderId && f.id !== CONFIG.webSeriesFolderId).map((f) => ({ type: "movie", id: `gdrive-root:${f.id}`, name: f.name }));
      const manifest = {
        id: "stremio.gdrive.sa.express",
        version: "1.0.0",
        name: CONFIG.addonName,
        description: "Google Drive addon (Express) - modular",
        resources: [
          { name: "stream", types: ["movie", "series"] },
          { name: "catalog", types: ["movie"], idPrefixes: ["gdrive-folder:", "gdrive-root:", "gdrive-hindi-dubbed", "gdrive-web-series"] },
          { name: "meta", types: ["movie", "series"], idPrefixes: ["gdrive:", "gdrive-folder:"] },
          { name: "download", types: ["movie", "series"] },
          ...(CONFIG.enableSearchCatalog || CONFIG.enableVideoCatalog ? [{ name: "search", types: ["movie"] }] : [])
        ],
        types: ["movie", "series"],
        catalogs: [
          ...hindiDubbedCatalogs,
          ...webSeriesCatalogs,
          ...rootCatalogs,
          ...(CONFIG.enableSearchCatalog ? [{ type: "movie", id: "gdrive_list", name: "Google Drive Files" }] : []),
          ...(CONFIG.enableVideoCatalog ? [{ type: "movie", id: "gdrive_search", name: "Google Drive Search", extra: [{ name: "search", isRequired: true }] }] : [])
        ]
      };
      res.set({
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      });
      res.status(200).send(manifest);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
};
