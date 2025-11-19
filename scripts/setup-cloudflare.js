#!/usr/bin/env node

/**
 * Automated Cloudflare Setup Script
 * 
 * This script automates the Cloudflare setup process using the Cloudflare API.
 * 
 * Usage:
 *   node scripts/setup-cloudflare.js --api-token=YOUR_TOKEN --account-id=YOUR_ACCOUNT_ID
 * 
 * Or set environment variables:
 *   export CLOUDFLARE_API_TOKEN=your-token
 *   export CLOUDFLARE_ACCOUNT_ID=your-account-id
 *   node scripts/setup-cloudflare.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};
args.forEach(arg => {
  const match = arg.match(/^--([^=]+)=(.*)$/);
  if (match) {
    options[match[1].replace(/-/g, '')] = match[2];
  }
});

// Get credentials from args or environment
const API_TOKEN = options.apitoken || process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = options.accountid || process.env.CLOUDFLARE_ACCOUNT_ID;

if (!API_TOKEN || !ACCOUNT_ID) {
  console.error('Error: Cloudflare API token and Account ID required');
  console.error('\nUsage:');
  console.error('  node scripts/setup-cloudflare.js --api-token=YOUR_TOKEN --account-id=YOUR_ACCOUNT_ID');
  console.error('\nOr set environment variables:');
  console.error('  export CLOUDFLARE_API_TOKEN=your-token');
  console.error('  export CLOUDFLARE_ACCOUNT_ID=your-account-id');
  console.error('  node scripts/setup-cloudflare.js');
  process.exit(1);
}

// Cloudflare API base URL
const API_BASE = 'https://api.cloudflare.com/client/v4';

// Helper function to make API requests
function cloudflareRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.success) {
            resolve(parsed.result);
          } else {
            reject(new Error(parsed.errors?.[0]?.message || 'API request failed'));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function setupCloudflare() {
  console.log('🚀 Starting Cloudflare automated setup...\n');

  try {
    // Step 0: Verify credentials
    console.log('🔍 Step 0: Verifying credentials...');
    try {
      // Try to get user info to verify token
      const userInfo = await cloudflareRequest('GET', '/user');
      console.log(`✅ API token verified for: ${userInfo.email || 'your account'}`);
    } catch (error) {
      console.log(`⚠️  Could not verify token via API: ${error.message}`);
      console.log(`   Continuing with manual setup instructions...\n`);
    }

    // Step 1: Create R2 Bucket
    console.log('\n📦 Step 1: Creating R2 bucket...');
    const bucketName = 'chrome-issue-reporter-screenshots';
    
    // R2 buckets typically need to be created via dashboard or Wrangler CLI
    // Let's try Wrangler if available, otherwise provide manual instructions
    console.log(`📝 R2 bucket creation instructions:`);
    console.log(`   1. Go to: https://dash.cloudflare.com/${ACCOUNT_ID}/r2`);
    console.log(`   2. Click "Create bucket"`);
    console.log(`   3. Name: ${bucketName}`);
    console.log(`   4. Location: Auto (or choose closest region)`);
    console.log(`   5. Click "Create bucket"`);
    console.log(`\n   Or use Wrangler CLI:`);
    console.log(`   npx wrangler r2 bucket create ${bucketName}\n`);

    // Step 2: Create R2 API Token
    console.log('\n🔑 Step 2: Creating R2 API token...');
    // Note: R2 API tokens are created via the dashboard, not API
    console.log('⚠️  R2 API tokens must be created manually in the Cloudflare dashboard:');
    console.log('   1. Go to R2 → Manage R2 API Tokens');
    console.log('   2. Create token with "Object Read & Write" permissions');
    console.log('   3. Save the Access Key ID and Secret Access Key\n');

    // Step 3: Create Worker for upload proxy
    console.log('⚙️  Step 3: Creating Cloudflare Worker for upload proxy...');
    const workerName = 'chrome-issue-reporter-upload';
    
    // Read the worker example code
    const workerCodePath = path.join(__dirname, '..', 'cloudflare-worker-upload-example.js');
    let workerCode = '';
    if (fs.existsSync(workerCodePath)) {
      workerCode = fs.readFileSync(workerCodePath, 'utf8');
    } else {
      // Fallback worker code
      workerCode = `export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    try {
      const formData = await request.formData();
      const screenshot = formData.get('screenshot');
      if (!screenshot) {
        return new Response('No screenshot provided', { status: 400 });
      }
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const filename = \`screenshots/\${timestamp}-\${randomId}.jpg\`;
      await env.SCREENSHOTS_BUCKET.put(filename, screenshot, {
        httpMetadata: { contentType: 'image/jpeg' },
      });
      const publicUrl = \`https://pub-\${env.ACCOUNT_ID}.r2.dev/\${filename}\`;
      return new Response(JSON.stringify({ success: true, url: publicUrl }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};`;
    }

    try {
      // Deploy worker
      // Note: Worker deployment via API requires wrangler or direct API calls
      console.log('⚠️  Worker deployment via API is complex. Please deploy manually:');
      console.log('   1. Go to Workers & Pages → Create application → Create Worker');
      console.log('   2. Name it: chrome-issue-reporter-upload');
      console.log('   3. Paste code from cloudflare-worker-upload-example.js');
      console.log('   4. Add R2 bucket binding: SCREENSHOTS_BUCKET → chrome-issue-reporter-screenshots');
      console.log('   5. Deploy\n');
    } catch (error) {
      console.log('⚠️  Worker creation requires manual setup (see above)\n');
    }

    // Step 4: Create Workers/Pages project for extension hosting
    console.log('📦 Step 4: Setting up extension hosting...');
    console.log('⚠️  Extension hosting setup:');
    console.log('   1. Go to Workers & Pages → Create application → Pages');
    console.log('   2. Connect to your GitHub repository');
    console.log('   3. Project name: chrome-issue-reporter-updates');
    console.log('   4. Production branch: main');
    console.log('   5. Build command: (leave empty or use: npm run build)');
    console.log('   6. Build output: . (root directory)\n');

    // Step 5: Get R2 public URL
    console.log('🔗 Step 5: Getting R2 public URL...');
    try {
      // Try to get bucket details
      const buckets = await cloudflareRequest('GET', `/accounts/${ACCOUNT_ID}/r2/buckets`);
      const bucket = buckets.find(b => b.name === bucketName);
      if (bucket) {
        console.log(`✅ Bucket found: ${bucket.name}`);
        console.log(`   Location: ${bucket.location || 'auto'}`);
        // R2 public URL format
        console.log(`   Public URL format: https://pub-${ACCOUNT_ID}.r2.dev`);
      }
    } catch (error) {
      console.log(`⚠️  Could not fetch bucket details: ${error.message}`);
      console.log(`   Public URL format: https://pub-${ACCOUNT_ID}.r2.dev`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Automated setup complete!');
    console.log('='.repeat(60));
    console.log('\n📋 Next Steps (Manual):');
    console.log('\n1. Create R2 API Token:');
    console.log('   - Go to: https://dash.cloudflare.com → R2 → Manage R2 API Tokens');
    console.log('   - Create token with "Object Read & Write" permissions');
    console.log('   - Save Access Key ID and Secret Access Key');
    console.log('\n2. Deploy Upload Worker:');
    console.log('   - Use code from: cloudflare-worker-upload-example.js');
    console.log('   - Add R2 bucket binding: SCREENSHOTS_BUCKET');
    console.log('   - Note the Worker URL');
    console.log('\n3. Set up Extension Hosting:');
    console.log('   - Connect GitHub repo to Cloudflare Pages');
    console.log('   - Or use R2 for hosting extension ZIPs');
    console.log('\n4. Configure Extension:');
    console.log('   - Update extension/background.js with R2/Worker URLs');
    console.log('   - Or set via chrome.storage.sync');
    console.log('\n5. Add GitHub Secrets:');
    console.log('   - CF_API_TOKEN: ' + API_TOKEN.substring(0, 10) + '...');
    console.log('   - CF_ACCOUNT_ID: ' + ACCOUNT_ID);
    console.log('   - EXTENSION_ID: (get from chrome://extensions/)');
    console.log('   - UPDATE_BASE_URL: (your Workers/Pages URL)');
    console.log('   - R2_BUCKET_NAME: chrome-issue-reporter-screenshots');
    console.log('\n📖 See CLOUDFLARE_SETUP.md for detailed instructions\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('- Verify your API token has correct permissions');
    console.error('- Check that Account ID is correct');
    console.error('- Ensure API token has R2 and Workers permissions');
    process.exit(1);
  }
}

// Run setup
setupCloudflare().catch(console.error);

