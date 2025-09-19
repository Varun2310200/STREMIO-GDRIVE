// src/utils/upstash.js
// Minimal Upstash KV client using REST. Uses upstashConfig.js (no env).
const fetch = require("node-fetch");
const cfg = require("../../upstashConfig");

if (!cfg || !cfg.restUrl || !cfg.token) {
  module.exports = { enabled: false };
  return;
}

const BASE = cfg.restUrl.replace(/\/$/, "");

async function get(key) {
  const url = `${BASE}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${cfg.token}` } });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j || j.error) return null;
  // Upstash returns { result: { value: <value> } } for get
  return j.result?.value ?? null;
}

async function put(key, value, ttlSeconds = 31536000) {
  const url = `${BASE}/set/${encodeURIComponent(key)}`;
  const body = JSON.stringify({ value, ex: ttlSeconds });
  const r = await fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` }});
  if (!r.ok) throw new Error("Upstash set failed");
  return true;
}

async function del(key) {
  const url = `${BASE}/del/${encodeURIComponent(key)}`;
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${cfg.token}` }});
  if (!r.ok) throw new Error("Upstash del failed");
  return true;
}

module.exports = { enabled: true, get, put, del };
