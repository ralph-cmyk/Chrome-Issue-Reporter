# Auto-Update Setup Guide

This guide will help you set up automatic updates for your Chrome extension using Cloudflare Workers and R2.

## 🎯 Overview

The auto-update system consists of:
1. **Cloudflare R2** - Stores extension ZIP files and update.xml
2. **Cloudflare Worker** - Serves files from R2 to Chrome browsers
3. **GitHub Actions** - Automatically builds and uploads new versions
4. **Chrome Extension** - Checks for updates automatically

## 📋 Prerequisites

- Cloudflare account (free tier works fine)
- Cloudflare R2 bucket already created
- Wrangler CLI installed: `npm install -g wrangler`

## 🚀 Step-by-Step Setup

### Step 1: Deploy the Cloudflare Worker

1. **Login to Cloudflare via Wrangler:**
   ```bash
   wrangler login
   ```

2. **Update the bucket name in `wrangler.toml`:**
   ```toml
   [[r2_buckets]]
   binding = "UPDATES_BUCKET"
   bucket_name = "YOUR-ACTUAL-BUCKET-NAME"  # Change this!
   ```

3. **Deploy the Worker:**
   ```bash
   wrangler deploy
   ```

4. **Note your Worker URL:**
   After deployment, you'll see:
   ```
   Published chrome-issue-reporter-updates (X.XX sec)
   https://chrome-issue-reporter-updates.YOUR-ACCOUNT.workers.dev
   ```
   
   **Save this URL - you'll need it!**

### Step 2: Update Extension Configuration

1. **Update `extension/manifest.json`:**
   Replace the `update_url` with your Worker URL:
   ```json
   {
     "update_url": "https://chrome-issue-reporter-updates.YOUR-ACCOUNT.workers.dev/update.xml"
   }
   ```

2. **Get your Extension ID:**
   - Load your extension in Chrome at `chrome://extensions/`
   - Enable "Developer mode"
   - Copy the Extension ID (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

### Step 3: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add/Update these secrets:

1. **CHROME_EXTENSION_ID**
   - Value: Your extension ID from Step 2

2. **UPDATE_BASE_URL**
   - Value: Your Worker URL from Step 1 (without trailing slash)
   - Example: `https://chrome-issue-reporter-updates.your-account.workers.dev`

3. **R2_BUCKET_NAME** (if not already set)
   - Value: Your R2 bucket name

4. **CF_ACCOUNT_ID** (if not already set)
   - Found in: Cloudflare Dashboard → R2 → Overview

5. **R2_ACCESS_KEY_ID** and **R2_SECRET_ACCESS_KEY** (if not already set)
   - Create in: Cloudflare Dashboard → R2 → Manage R2 API Tokens

### Step 4: Test the Setup

1. **Trigger the GitHub Action:**
   ```bash
   git add .
   git commit -m "Setup auto-updates"
   git push origin main
   ```

2. **Verify the upload:**
   - Go to your GitHub repository → Actions
   - Watch the "Deploy to Cloudflare" workflow
   - It should upload `update.xml` and the extension ZIP to R2

3. **Test the Worker:**
   Open in your browser:
   ```
   https://chrome-issue-reporter-updates.YOUR-ACCOUNT.workers.dev/update.xml
   ```
   
   You should see XML like:
   ```xml
   <?xml version='1.0' encoding='UTF-8'?>
   <gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
     <app appid='YOUR-EXTENSION-ID'>
       <updatecheck codebase='https://...' version='21.0.0' />
     </app>
   </gupdate>
   ```

### Step 5: Test Auto-Updates

1. **Load your extension in Chrome** (with the updated manifest.json)

2. **Increment the version:**
   - Edit `extension/manifest.json`
   - Change version from `21.0.0` to `21.0.1`

3. **Commit and push:**
   ```bash
   git add extension/manifest.json
   git commit -m "Bump version to 21.0.1"
   git push origin main
   ```

4. **Wait for GitHub Action to complete** (~2-3 minutes)

5. **Manually check for updates:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Update" button at the top
   - Your extension should update to 21.0.1!

## 🎉 How It Works

### Automatic Update Flow

1. **When you push to main:**
   - GitHub Action builds the extension
   - Creates update.xml with new version
   - Uploads both to Cloudflare R2

2. **Chrome checks for updates (every 5-6 hours):**
   - Fetches your `update_url` (the Worker)
   - Worker serves update.xml from R2
   - Chrome compares versions

3. **If new version available:**
   - Chrome downloads the ZIP from Worker
   - Installs update automatically
   - User sees updated extension (no action needed!)

### Version Checking in Extension

The extension now has a visual update checker in the Options page:
- Shows current version
- Checks update.xml for latest version
- Displays banner if update available
- Tells user update will install automatically

## 🔧 Maintenance

### Publishing a New Version

1. **Update the version** in `extension/manifest.json`
2. **Commit and push** to main branch
3. **Wait for GitHub Action** to complete
4. **Done!** Users get updates automatically within ~5-6 hours

### Manual Upload (if needed)

```bash
# Build and generate files
npm run build-update -- \
  --extension-id=YOUR_EXTENSION_ID \
  --update-url=https://chrome-issue-reporter-updates.YOUR-ACCOUNT.workers.dev

# Upload to R2 using Wrangler
wrangler r2 object put \
  chrome-issue-reporter-screenshots/update.xml \
  --file=update.xml

wrangler r2 object put \
  chrome-issue-reporter-screenshots/extensions/chrome-issue-reporter-v21.0.0.zip \
  --file=chrome-issue-reporter-v21.0.0.zip
```

## 🐛 Troubleshooting

### Update.xml not found (404)

**Problem:** Worker returns 404 for `/update.xml`

**Solution:**
1. Verify file exists in R2: `wrangler r2 object list chrome-issue-reporter-screenshots`
2. Check bucket binding in `wrangler.toml` matches your bucket name
3. Redeploy worker: `wrangler deploy`

### Extension not updating

**Problem:** Chrome doesn't detect new version

**Checklist:**
- [ ] Is `update_url` in manifest.json correct?
- [ ] Does update.xml exist at that URL? (open in browser)
- [ ] Is the version in update.xml newer than installed version?
- [ ] Is the extension ID in update.xml correct?
- [ ] Try manual update: `chrome://extensions/` → "Update" button

### Worker not serving files

**Problem:** Worker returns errors

**Solution:**
1. Check Worker logs: `wrangler tail chrome-issue-reporter-updates`
2. Verify R2 bucket binding: `wrangler r2 bucket list`
3. Test Worker directly: `curl https://your-worker.workers.dev/update.xml`

### GitHub Action failing

**Problem:** Deploy workflow fails

**Common causes:**
- Missing GitHub secrets
- Incorrect R2 credentials
- Wrong bucket name
- Invalid extension ID format

**Solution:** Check the workflow logs and verify all secrets are set correctly.

## 📚 Additional Resources

- [Chrome Extension Update Docs](https://developer.chrome.com/docs/extensions/mv3/hosting/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

## 🔐 Security Notes

- Update files are served over HTTPS
- R2 bucket should NOT be publicly writable
- Only GitHub Actions should upload files
- Extension validates versions before updating
- Chrome verifies CRX signatures

## ✅ Quick Checklist

Before going live, verify:

- [ ] Worker deployed and accessible
- [ ] Update.xml exists and is valid
- [ ] Extension manifest has correct update_url
- [ ] GitHub secrets all configured
- [ ] Test update completes successfully
- [ ] Version checking shows in Options page
- [ ] Manual update works in Chrome
- [ ] Automatic update tested (wait 5-6 hours or force check)

---

**Need Help?** Check the troubleshooting section or open an issue on GitHub!
