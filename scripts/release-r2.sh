#!/usr/bin/env bash
set -euo pipefail

# Required env vars:
#   UPDATE_BASE_URL  (e.g., https://chrome-issue-reporter-updates.super-extreme.workers.dev)
#   EXTENSION_ID     (Chrome extension ID)
#   R2_BUCKET_NAME   (e.g., chrome-issue-reporter-screenshots)
#
# Requires: wrangler logged in (wrangler login), npm, node

if [[ -z "${UPDATE_BASE_URL:-}" || -z "${EXTENSION_ID:-}" || -z "${R2_BUCKET_NAME:-}" ]]; then
  echo "Missing env. Set UPDATE_BASE_URL, EXTENSION_ID, R2_BUCKET_NAME." >&2
  exit 1
fi

VERSION=$(node -p "require('./extension/manifest.json').version")
ZIP_NAME="chrome-issue-reporter-v${VERSION}.zip"
DOWNLOAD_URL="${UPDATE_BASE_URL}/extensions/${ZIP_NAME}"

echo "Building and packaging v${VERSION}..."
UPDATE_BASE_URL="${UPDATE_BASE_URL}" npm run package

echo "Generating update.xml..."
node scripts/update-manifest.js "${EXTENSION_ID}" "${VERSION}" "${DOWNLOAD_URL}" update.xml

echo "Uploading versioned ZIP to R2..."
wrangler r2 object put "${R2_BUCKET_NAME}/extensions/${ZIP_NAME}" --file="${ZIP_NAME}" --remote

echo "Uploading latest alias ZIP to R2..."
wrangler r2 object put "${R2_BUCKET_NAME}/extensions/chrome-issue-reporter-latest.zip" --file="${ZIP_NAME}" --remote

echo "Uploading update.xml to R2..."
wrangler r2 object put "${R2_BUCKET_NAME}/update.xml" --file=update.xml --remote

echo "✅ Release pushed to R2:"
echo "   - ${DOWNLOAD_URL}"
echo "   - ${UPDATE_BASE_URL}/extensions/chrome-issue-reporter-latest.zip"
echo "   - ${UPDATE_BASE_URL}/update.xml"
