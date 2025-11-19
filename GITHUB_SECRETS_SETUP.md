# GitHub Secrets Setup Guide

## Where to Add Secrets

Go to your GitHub repository settings:
**https://github.com/ralph-cmyk/Chrome-Issue-Reporter/settings/secrets/actions**

## Required Secrets

Click **"New repository secret"** for each of these (except CHROME_EXTENSION_ID which already exists):

### 1. CF_API_TOKEN
- **Name:** `CF_API_TOKEN`
- **Value:** `QcQgvgWGcjuPdSc1CaBinETVyl4ppUK62Mf1Zkee`
- **Description:** Cloudflare API token for deploying to R2 and Workers

### 2. CF_ACCOUNT_ID
- **Name:** `CF_ACCOUNT_ID`
- **Value:** `6aff29174a263fec1dd8515745970ba3`
- **Description:** Your Cloudflare account ID

### 3. CHROME_EXTENSION_ID
- **Name:** `CHROME_EXTENSION_ID` ✅ **Already exists!**
- **Value:** (Already configured - used by both Chrome Web Store and Cloudflare workflows)
- **Description:** Your Chrome extension ID (needed for update.xml and Web Store publishing)

### 4. UPDATE_BASE_URL
- **Name:** `UPDATE_BASE_URL`
- **Value:** (Get this after deploying to Cloudflare Pages/Workers)
  - If using Cloudflare Pages: `https://chrome-issue-reporter-updates.pages.dev`
  - If using Workers: `https://chrome-issue-reporter-updates.your-account.workers.dev`
  - Or your custom domain
- **Description:** Base URL where extension packages and update.xml are hosted

### 5. R2_BUCKET_NAME
- **Name:** `R2_BUCKET_NAME`
- **Value:** `chrome-issue-reporter-screenshots`
- **Description:** R2 bucket name for storing extension packages and update.xml

### 6. R2_ACCESS_KEY_ID
- **Name:** `R2_ACCESS_KEY_ID`
- **Value:** `38142b72ea8ec8343fe80526339e6f9c`
- **Description:** R2 Access Key ID for S3-compatible API uploads

### 7. R2_SECRET_ACCESS_KEY
- **Name:** `R2_SECRET_ACCESS_KEY`
- **Value:** `f34b352a18e31839b9e66cb639fa3234201000085d17f513328e2ca9ee7b5784`
- **Description:** R2 Secret Access Key for S3-compatible API uploads

## Quick Setup Steps

1. **Get Extension ID:**
   ```bash
   # Open Chrome and go to:
   chrome://extensions/
   # Enable Developer mode, find your extension, copy the ID
   ```

2. **Deploy to Cloudflare Pages/Workers:**
   - Set up Cloudflare Pages connected to your GitHub repo
   - Or deploy a Worker to serve files
   - Note the URL (this becomes UPDATE_BASE_URL)

3. **Add All Secrets:**
   - Go to: https://github.com/ralph-cmyk/Chrome-Issue-Reporter/settings/secrets/actions
   - Click "New repository secret" for each secret above
   - Paste the values

4. **Test Auto-Deploy:**
   - Push a change to `main` branch
   - Check GitHub Actions tab to see deployment
   - Verify files uploaded to Cloudflare

## Verification

After adding secrets, you can verify they're set (but not view values) at:
https://github.com/ralph-cmyk/Chrome-Issue-Reporter/settings/secrets/actions

You should see all required secrets listed. Note: `CHROME_EXTENSION_ID` already exists from the Chrome Web Store workflow.

## Workflow Usage

The `.github/workflows/deploy-to-cloudflare.yml` workflow will automatically use these secrets when you push to `main`:

- `CF_API_TOKEN` - Authenticates with Cloudflare API
- `CF_ACCOUNT_ID` - Identifies your Cloudflare account
- `CHROME_EXTENSION_ID` - Used in update.xml generation (✅ already exists)
- `UPDATE_BASE_URL` - Base URL for update.xml and extension ZIPs
- `R2_BUCKET_NAME` - Where to upload extension packages

## Security Notes

- ✅ Secrets are encrypted and only accessible to GitHub Actions
- ✅ Secret values are never shown in logs (they're masked)
- ✅ Only repository admins can view/manage secrets
- ⚠️ Never commit secrets to code or commit messages

