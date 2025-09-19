// src/utils/cache.js
// Uses Upstash when available, otherwise in-memory fallback.
const upstash = require("./upstash");
const inMemory = new Map();

async function get(key) {
  if (upstash && upstash.enabled) {
    const v = await upstash.get(key);
    if (v === null || v === undefined) return null;
    try { return JSON.parse(v); } catch (e) { return v; }
  }
  const entry = inMemory.get(key);
  if (!entry) return null;
  if (entry.exp && Date.now() > entry.exp) { inMemory.delete(key); return null; }
  return entry.value;
}

async function put(key, value, ttl = 31536000) {
  if (upstash && upstash.enabled) {
    const storeVal = (typeof value === "string") ? value : JSON.stringify(value);
    await upstash.put(key, storeVal, ttl);
    return;
  }
  const entry = { value, exp: Date.now() + ttl * 1000 };
  inMemory.set(key, entry);
}

async function del(key) {
  if (upstash && upstash.enabled) {
    await upstash.del(key);
    return;
  }
  inMemory.delete(key);
}

module.exports = { get, put, delete: del };
