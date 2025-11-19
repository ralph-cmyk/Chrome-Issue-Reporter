#!/usr/bin/env node

/**
 * Builds extension, updates version, generates update.xml, and uploads to Cloudflare
 * Usage: node scripts/build-update.js [--version=X.X.X] [--extension-id=ID] [--update-url=URL]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};
args.forEach(arg => {
  const match = arg.match(/^--([^=]+)=(.*)$/);
  if (match) {
    options[match[1]] = match[2];
  }
});

// Load current manifest
const manifestPath = path.join(__dirname, '..', 'extension', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Get or update version
const newVersion = options.version || incrementVersion(manifest.version);
if (options.version) {
  manifest.version = newVersion;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Updated version to ${newVersion}`);
}

// Build extension
console.log('Building extension...');
execSync('npm run package', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

// Get extension ID and update URL from environment or options
const extensionId = options['extension-id'] || process.env.EXTENSION_ID || '';
const updateBaseUrl = options['update-url'] || process.env.UPDATE_BASE_URL || '';

if (!extensionId) {
  console.error('Error: Extension ID required. Set EXTENSION_ID environment variable or use --extension-id=ID');
  process.exit(1);
}

if (!updateBaseUrl) {
  console.error('Error: Update base URL required. Set UPDATE_BASE_URL environment variable or use --update-url=URL');
  process.exit(1);
}

// Generate download URL
const zipFilename = `chrome-issue-reporter-v${newVersion}.zip`;
const downloadUrl = `${updateBaseUrl}/extensions/${zipFilename}`;

// Generate update.xml
console.log('Generating update.xml...');
const updateXmlPath = path.join(__dirname, '..', 'update.xml');
try {
  execSync(`node scripts/update-manifest.js "${extensionId}" "${newVersion}" "${downloadUrl}" "${updateXmlPath}"`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('Failed to generate update.xml:', error.message);
  process.exit(1);
}

console.log('\n✅ Build complete!');
console.log(`Version: ${newVersion}`);
console.log(`Extension ID: ${extensionId}`);
console.log(`Download URL: ${downloadUrl}`);
console.log(`\nNext steps:`);
console.log(`1. Upload ${zipFilename} to Cloudflare Workers/Pages at: ${updateBaseUrl}/extensions/`);
console.log(`2. Upload update.xml to Cloudflare Workers/Pages at: ${updateBaseUrl}/update.xml`);
console.log(`3. Test the update mechanism`);

function incrementVersion(version) {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1; // Increment patch version
  return parts.join('.');
}

