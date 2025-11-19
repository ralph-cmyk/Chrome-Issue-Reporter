#!/usr/bin/env node

/**
 * Generates Chrome extension update.xml manifest file
 * Usage: node scripts/update-manifest.js <extension-id> <version> <download-url>
 */

const fs = require('fs');
const path = require('path');

const [extensionId, version, downloadUrl] = process.argv.slice(2);

if (!extensionId || !version || !downloadUrl) {
  console.error('Usage: node scripts/update-manifest.js <extension-id> <version> <download-url>');
  console.error('Example: node scripts/update-manifest.js abcdefghijklmnopqrstuvwxyz123456 21.0.0 https://example.com/extensions/extension-v21.0.0.zip');
  process.exit(1);
}

const updateXml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${extensionId}'>
    <updatecheck codebase='${downloadUrl}' version='${version}' />
  </app>
</gupdate>`;

console.log('Generated update.xml:');
console.log(updateXml);

// Optionally write to file (4th argument, since 0=node, 1=script, 2-4=args)
const outputPath = process.argv[4] || path.join(__dirname, '..', 'update.xml');
if (outputPath) {
  fs.writeFileSync(outputPath, updateXml, 'utf8');
  console.log(`\nWritten to: ${outputPath}`);
}

