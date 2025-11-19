#!/usr/bin/env node

/**
 * Generates Chrome extension update.xml manifest file
 * Usage: node scripts/update-manifest.js <extension-id> <version> <download-url>
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const [extensionId, version, downloadUrl, outputPathArg] = args;

if (!extensionId || !version || !downloadUrl) {
  console.error('Usage: node scripts/update-manifest.js <extension-id> <version> <download-url> [output-path]');
  console.error('Example: node scripts/update-manifest.js abcdefghijklmnopqrstuvwxyz123456 21.0.0 https://example.com/extensions/extension-v21.0.0.zip update.xml');
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

// Write to file (4th argument is optional output path)
const outputPath = outputPathArg || path.join(__dirname, '..', 'update.xml');
fs.writeFileSync(outputPath, updateXml, 'utf8');
console.log(`\nWritten to: ${outputPath}`);

