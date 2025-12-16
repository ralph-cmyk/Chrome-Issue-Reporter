#!/usr/bin/env node
/**
 * Patch dist/manifest.json update_url from UPDATE_BASE_URL.
 *
 * This keeps the repo's source manifest portable while ensuring packaged builds
 * point to the correct Cloudflare Worker update manifest.
 */

const fs = require("fs");
const path = require("path");

const updateBaseUrl = (process.env.UPDATE_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
if (!updateBaseUrl) {
  // No-op (e.g. local dev without auto-update hosting)
  process.exit(0);
}

const manifestPath = path.join(__dirname, "..", "dist", "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`dist manifest not found at ${manifestPath}. Run build first.`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.update_url = `${updateBaseUrl}/update.xml`;
fs.writeFileSync(
  manifestPath,
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8",
);
console.log(`Updated dist/manifest.json update_url -> ${manifest.update_url}`);
