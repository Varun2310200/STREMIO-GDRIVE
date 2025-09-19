// src/utils/gdriveApi.js
// Google Service Account JWT auth + small fetch wrapper.
// NOTE: this file assumes service account objects are provided as:
// { client_email: "...", private_key: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" }

const fetch = require("node-fetch");
const crypto = require("crypto");

// helpers
function b64urlEncodeBuffer(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlEncode(input) {
  // accepts Buffer or string
  if (Buffer.isBuffer(input)) return b64urlEncodeBuffer(input);
  return b64urlEncodeBuffer(Buffer.from(String(input), "utf8"));
}
function b64urlFromJson(obj) {
  return b64urlEncode(Buffer.from(JSON.stringify(obj), "utf8"));
}

let CONFIG = null;
let SERVICE_ACCOUNTS = null;

function init(cfg, sas) {
  CONFIG = cfg || {};
  SERVICE_ACCOUNTS = Array.isArray(sas) ? sas : [];
}

// sign dataBuffer (unsigned JWT) with RS256 using service account private_key
async function signJwtRS256(privateKeyPem, dataBuffer) {
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(dataBuffer);
  sign.end();
  const sigBase64 = sign.sign(privateKeyPem, "base64");
  return Buffer.from(sigBase64, "base64");
}

const API = {
  TOKEN: "https://oauth2.googleapis.com/token",
  DRIVE_FILES: "https://content.googleapis.com/drive/v3/files",
  DRIVE_FILE: (id, fields = "*") =>
    `https://content.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`,
  DRIVE_MEDIA: (id) => `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`
};

const tokenCache = new Map(); // key: client_email -> { token, exp }
let saIndex = 0;

function stringifyParams(params) {
  const out = {};
  for (const [k, v] of Object.entries(params)) out[k] = String(v);
  return out;
}

async function getActiveTokens(count = 1) {
  if (!SERVICE_ACCOUNTS || SERVICE_ACCOUNTS.length === 0) throw new Error("No service accounts configured");
  const tokens = [];
  const maxTokens = Math.min(count, SERVICE_ACCOUNTS.length);
  for (let i = 0; i < maxTokens; i++) {
    const idx = (saIndex + i) % SERVICE_ACCOUNTS.length;
    const sa = SERVICE_ACCOUNTS[idx];
    if (!sa || !sa.client_email || !sa.private_key) {
      console.warn("Service account missing fields at index", idx);
      continue;
    }
    const cached = tokenCache.get(sa.client_email);
    if (cached && cached.exp > Date.now() + 30 * 1000) {
      tokens.push({ token: cached.token, email: sa.client_email });
      continue;
    }
    try {
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/drive",
        aud: API.TOKEN,
        iat: now,
        exp: now + Math.min((CONFIG && CONFIG.tokenTtl) ? CONFIG.tokenTtl : 3500, 3500)
      };
      const header = { alg: "RS256", typ: "JWT" };
      const unsigned = `${b64urlFromJson(header)}.${b64urlFromJson(claims)}`;
      const signature = await signJwtRS256(sa.private_key, Buffer.from(unsigned));
      const assertion = `${unsigned}.${b64urlEncode(signature)}`;
      const paramsObj = stringifyParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      });
      const body = new URLSearchParams(paramsObj);
      const resp = await fetch(API.TOKEN, { method: "POST", body });
      if (!resp.ok) throw new Error(`token http ${resp.status}`);
      const j = await resp.json();
      if (!j || !j.access_token) throw new Error("no access_token returned");
      const expAt = Date.now() + (j.expires_in ? j.expires_in * 1000 : 3600 * 1000) - 60 * 1000;
      tokenCache.set(sa.client_email, { token: j.access_token, exp: expAt });
      tokens.push({ token: j.access_token, email: sa.client_email });
    } catch (e) {
      // Helpful debug output
      console.warn("Token generation failed for SA:", sa?.client_email, e.message || e);
      continue;
    }
  }
  if (tokens.length === 0) throw new Error("All service accounts failed to obtain token");
  return tokens;
}

async function saAccessToken() {
  const tokens = await getActiveTokens(1);
  return tokens[0].token;
}

// wrapper to fetch Google endpoints with SA Bearer token and basic retry/backoff
async function withSaFetch(url, init = {}) {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const token = await saAccessToken();
      const r = await fetch(url, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` }
      });
      if (r.ok) return r;
      // handle backoff for rate-limit
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 1000));
        continue;
      }
      // if auth error, rotate account index and retry
      if ([401, 403].includes(r.status)) {
        saIndex = (saIndex + 1) % (SERVICE_ACCOUNTS.length || 1);
        continue;
      }
      return r;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
    }
  }
  // fallback: try one last time
  const token = await saAccessToken();
  return fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
}

module.exports = { init, withSaFetch, saAccessToken, API };
