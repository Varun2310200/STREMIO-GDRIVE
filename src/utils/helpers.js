// src/utils/helpers.js
function b64urlEncode(input) {
  const b64 = Buffer.isBuffer(input) ? input.toString("base64") : Buffer.from(String(input)).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(s) {
  // Accept base64url and decode to utf8 string
  if (!s) return null;
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64").toString("utf8");
}
function fmtSize(bytes) {
  if (!bytes || isNaN(bytes)) return "Unknown";
  const k = 1000, units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}
function extractCleanTitle(filename) {
  return filename
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/(1080p|720p|480p|4k|hd|uhd|bluray|webrip|webdl|dvdrip|x264|x265|hevc|aac|ac3|dts)/gi, "")
    .replace(/[\._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeSearchQuery(query) {
  return query.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokenizeQuery(query) {
  return query.split(" ").filter((token) => token.length > 2);
}
module.exports = { b64urlEncode, b64urlDecode, fmtSize, extractCleanTitle, normalizeSearchQuery, tokenizeQuery };
