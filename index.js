// index.js
// Entry point - loads config, service accounts, mounts routes
const express = require("express");
const bodyParser = require("body-parser");
const config = require("./config");
const serviceAccounts = require("./serviceAccounts");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// attach config & SAs to app.locals for routes
app.locals.CONFIG = config;
app.locals.SERVICE_ACCOUNTS = serviceAccounts;

// mount routes (they will call gdrive.init inside)
const manifestRoute = require("./src/routes/manifest");
const searchRoute = require("./src/routes/search");
const catalogRoute = require("./src/routes/catalog");
const metaRoute = require("./src/routes/meta");
const streamRoute = require("./src/routes/stream");
const downloadRoute = require("./src/routes/download");
const playbackRoute = require("./src/routes/playback");

// mount
manifestRoute(app);
searchRoute(app);
catalogRoute(app);
metaRoute(app);
streamRoute(app);
downloadRoute(app);
playbackRoute(app);

app.options("*", (req, res) => {
  res.set({
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS,POST",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400"
  });
  res.sendStatus(204);
});

app.get("/", (req, res) => res.redirect(301, (config.baseUrl || `${req.protocol}://${req.get("host")}/`) + "manifest.json"));

app.get("/_health", (req, res) => res.status(200).json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GDrive addon server running on port ${PORT}`));
