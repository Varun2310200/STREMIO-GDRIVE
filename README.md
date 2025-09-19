# Stremio GDrive Addon (modular)

This repo is a modular Express-based Stremio Google Drive addon.

**Design choices**
- No environment variables: `serviceAccounts.js` and `upstashConfig.js` contain credentials (as requested).
- Optional Upstash KV integration. If `upstashConfig.js` is filled, cache uses Upstash; otherwise in-memory fallback.

**Deploy**
1. Fill `serviceAccounts.js` with your service account objects.
2. Fill `config.js` (baseUrl and folder IDs).
3. Fill `upstashConfig.js` if you want persistent KV (optional).
4. `git add . && git commit -m "init addon"`
5. Push to GitHub and deploy on Render (or any Node host).
   - Build command: `npm install`
   - Start command: `npm start`
6. Visit `https://<your-render-url>/manifest.json`

**Security**
Storing secrets in repo is insecure. Consider private repo or rotate keys if leaked.

