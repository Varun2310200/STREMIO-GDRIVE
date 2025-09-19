// config.js
module.exports = {
  addonName: "GDrive",
  baseUrl: "https://stremio-ayue.onrender.com/", // <-- set your render URL (must end with /)
  proxiedPlayback: false,
  showAudioFiles: false,
  pageSize: "100",
  defaultSubLang: "en",
  tokenTtl: 3000,
  listCacheTtl: 300,
  metaCacheTtl: 600,
  itemsPerCatalogPage: 50,
  concurrentRequests: 10,
  maxFilesToFetch: 1000,
  enableSearchCatalog: true,
  enableVideoCatalog: true,
  enableDownloads: true,
  maxDownloadSize: 5368709120,
  downloadTokenExpiry: 3600,
  kvCacheEnabled: false,
  kvCacheTtl: 31536000,
  hindiDubbedFolderId: "1X18vIlx0I74wcXLYFYkKs1Xo_vW9jw6i",
  webSeriesFolderId: "1kNiheEQTfld1wpaYsMsZ8O6cLXHSTIKN",
  rootFolders: [
  { id: "1X18vIlx0I74wcXLYFYkKs1Xo_vW9jw6i", name: "Hindi Dubbed" },
    { id: "1-NwN-Rxwwaxe9baXu26owKMXP5urzLQ4", name: "Crunchyroll" },
    { id: "1-qKf0GOsySvIZMpMjE6-SwcGe40opFGM", name: "Bollywood" },
    { id: "18llWh5xMxb8J3FcJDCYX3RXlrcG7zZKs", name: "Animated Movies" },
    { id: "1kNiheEQTfld1wpaYsMsZ8O6cLXHSTIKN", name: "Web Series" },
    { id: "1R3S20D0kbDlA9jCIpfBH-bTWQKQ2pw-C", name: "Korean Hindi Dubbed" },
    { id: "1RERSOWOUrCn_q3qv0PeBxY9ieX-h0pO4", name: "Korean EngSUB Dubbed" },
    { id: "11ZRNBYIn6h8qYwtunfSJ9Rk9Zl-9T5oG", name: "Anime" },
    { id: "1GB8QbOXv7cieHFSOKkD2SjgHSdNIiYjQ", name: "Turkish Drama" },
    { id: "12DlbrimUSw8It-J_xLU3ckFmLWc44Gnj", name: "South Hindi Dubbed" }
  ]
};
