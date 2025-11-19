# Cloudflare Setup Guide

This guide walks you through setting up Cloudflare R2 for screenshot storage and Cloudflare Workers/Pages for extension hosting and auto-updates.

## Prerequisites

- Cloudflare account (free tier is sufficient)
- Chrome extension ID (get from `chrome://extensions/` in developer mode, or generate one)

## Part 1: Cloudflare R2 Setup (Screenshot Storage)

### Step 1: Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** → **Create bucket**
3. Enter bucket name: `chrome-issue-reporter-screenshots` (or your preferred name)
4. Click **Create bucket**

### Step 2: Configure Bucket for Public Access

1. Click on your bucket
2. Go to **Settings** tab
3. Under **Public Access**, enable **Public Access**
4. Note the **Public URL** (e.g., `https://pub-xxxxx.r2.dev`)

### Step 3: Set Up CORS

1. In bucket settings, scroll to **CORS Policy**
2. Add the following CORS configuration:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

3. Click **Save**

### Step 4: Configure Lifecycle Rules (14-day Auto-Deletion)

1. In bucket settings, go to **Lifecycle Rules**
2. Click **Create rule**
3. Configure:
   - **Rule name:** `auto-delete-14-days`
   - **Object prefix:** `screenshots/`
   - **Delete objects after:** `14 days`
4. Click **Create rule**

### Step 5: Create R2 API Token

1. Go to **R2** → **Manage R2 API Tokens**
2. Click **Create API Token**
3. Configure:
   - **Token name:** `chrome-issue-reporter-upload`
   - **Permissions:** `Object Read & Write`
   - **TTL:** Leave empty (no expiration) or set as needed
   - **Buckets:** Select your bucket
4. Click **Create API Token**
5. **IMPORTANT:** Copy and save:
   - **Access Key ID**
   - **Secret Access Key** (you won't be able to see it again!)

### Step 6: Get R2 Endpoint URL

1. In R2 dashboard, note your **Account ID**
2. Your R2 endpoint will be: `https://<account-id>.r2.cloudflarestorage.com`
   - Replace `<account-id>` with your actual account ID

## Part 2: Cloudflare Workers/Pages Setup (Extension Hosting)

### Step 1: Create Workers Project

1. Go to **Workers & Pages** in Cloudflare Dashboard
2. Click **Create application** → **Create Worker**
3. Name it: `chrome-issue-reporter-updates`
4. Click **Deploy**

### Step 2: Configure Worker for Static File Hosting

You have two options:

#### Option A: Use Cloudflare Pages (Recommended)

1. Go to **Workers & Pages** → **Create application** → **Pages**
2. Connect to your GitHub repository (optional) or upload files manually
3. Create a folder structure:
   ```
   /
   ├── extensions/
   │   └── (extension ZIP files go here)
   └── update.xml
   ```

#### Option B: Use Worker with Static Assets

1. In your Worker, add this code to serve static files:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Serve update.xml
    if (url.pathname === '/update.xml') {
      // You can store update.xml in Worker KV or serve from R2
      // For now, we'll serve it from R2 or generate dynamically
      return new Response('update.xml content', {
        headers: { 'Content-Type': 'application/xml' }
      });
    }
    
    // Serve extension ZIP files
    if (url.pathname.startsWith('/extensions/')) {
      const filename = url.pathname.split('/').pop();
      // Fetch from R2 or serve from Worker KV
      // Implementation depends on your setup
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
```

### Step 3: Note Your Workers URL

After deployment, note your Workers URL:
- Format: `https://chrome-issue-reporter-updates.<your-account>.workers.dev`
- Or your custom domain if configured

## Part 3: Configure Extension

### Step 1: Set Up Cloudflare Worker Proxy (Recommended)

For secure uploads, create a Cloudflare Worker that acts as a proxy between the extension and R2.

1. Create a new Worker in Cloudflare Dashboard
2. Use the example code from `cloudflare-worker-upload-example.js`
3. Add R2 bucket binding: In Worker settings → Variables → Add binding
   - Binding name: `SCREENSHOTS_BUCKET`
   - R2 bucket: Select your bucket
4. Deploy the Worker
5. Note the Worker URL (e.g., `https://screenshot-upload.your-account.workers.dev`)

### Step 2: Configure Extension with R2 Settings

You need to configure the extension. You have two options:

#### Option A: Use Worker Proxy (Recommended - Most Secure)

Edit `extension/background.js` and update the default config, or configure via extension options:

```javascript
// In background.js, update getR2Config() or set via chrome.storage.sync
{
  workerProxyUrl: 'https://screenshot-upload.your-account.workers.dev/upload'
}
```

#### Option B: Direct R2 Upload (Less Secure)

Edit `extension/background.js` and update the constants:

```javascript
const DEFAULT_R2_ENDPOINT = 'https://<your-account-id>.r2.cloudflarestorage.com';
const DEFAULT_R2_BUCKET_NAME = 'chrome-issue-reporter-screenshots';
const DEFAULT_R2_PUBLIC_URL = 'https://pub-xxxxx.r2.dev'; // Your R2 public URL
```

**Note:** Direct upload requires public bucket with CORS, which is less secure. Worker proxy is recommended.

### Step 2: Update Manifest with Update URL

Edit `extension/manifest.json` and update the `update_url`:

```json
{
  "update_url": "https://chrome-issue-reporter-updates.<your-account>.workers.dev/update.xml"
}
```

Replace `<your-account>` with your actual Workers subdomain.

### Step 3: Get or Set Extension ID

1. Load extension in developer mode: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder
4. Note the Extension ID (32-character string)
5. Or set a specific ID in `manifest.json` using the `key` field

## Part 4: Publishing Updates

### Step 1: Build and Package Extension

```bash
npm run build-update -- --extension-id=YOUR_EXTENSION_ID --update-url=https://your-workers-url.workers.dev
```

Or set environment variables:

```bash
export EXTENSION_ID="your-extension-id"
export UPDATE_BASE_URL="https://your-workers-url.workers.dev"
npm run build-update
```

This will:
1. Build the extension
2. Create a ZIP file
3. Generate `update.xml`
4. Output instructions for uploading

### Step 2: Upload Files to Cloudflare

#### If using Cloudflare Pages:

1. Upload the extension ZIP to the `extensions/` folder
2. Upload `update.xml` to the root

#### If using Workers:

1. Upload extension ZIP to R2 or Worker KV
2. Update Worker code to serve `update.xml` and ZIP files

### Step 3: Test Auto-Update

1. Install extension from local ZIP (developer mode)
2. Wait a few minutes for Chrome to check for updates
3. Or manually trigger update check: `chrome://extensions/` → Developer mode → "Update extensions now"
4. Verify extension updates automatically

## Part 5: Testing

### Test Screenshot Upload

1. Use the extension to create an issue with a screenshot
2. Verify screenshot appears in R2 bucket
3. Verify screenshot URL works in GitHub issue
4. Wait 14 days and verify screenshot is automatically deleted

### Test Auto-Update

1. Create a new version of the extension
2. Upload to Cloudflare
3. Verify Chrome detects and installs the update

## Troubleshooting

### Screenshots Not Uploading

- Check R2 bucket permissions
- Verify CORS configuration
- Check R2 endpoint URL is correct
- Verify API token has correct permissions

### Auto-Update Not Working

- Verify `update_url` in manifest.json is correct
- Check that `update.xml` is accessible at the URL
- Verify extension ID matches in `update.xml` and manifest
- Check Chrome extension update logs: `chrome://extensions/` → Developer mode → "Errors"

### CORS Errors

- Ensure CORS policy allows your origin
- Check that R2 bucket has public access enabled
- Verify CORS headers are correct

## Security Notes

- **Never commit R2 credentials to git**
- Consider using a Cloudflare Worker proxy for uploads (keeps credentials server-side)
- Use environment variables for sensitive configuration
- Regularly rotate API tokens

## Next Steps

- ✅ **Set up automated deployment via GitHub Actions** - See `CLOUDFLARE_AUTO_DEPLOY.md`
- Configure custom domain for Workers/Pages
- Set up monitoring and logging
- Implement screenshot cleanup monitoring

## Auto-Deploy Setup

See `CLOUDFLARE_AUTO_DEPLOY.md` for complete instructions on setting up automatic deployment from GitHub to Cloudflare.

