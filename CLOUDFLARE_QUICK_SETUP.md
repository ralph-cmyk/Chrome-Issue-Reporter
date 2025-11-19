# Cloudflare Quick Setup Guide

## What You Need to Provide

To automate the Cloudflare setup, I need just **2 things** from you:

### 1. Cloudflare API Token
- Go to: https://dash.cloudflare.com/profile/api-tokens
- Click "Create Token"
- Use "Edit Cloudflare Workers" template
- Add these permissions:
  - **Account** → **Cloudflare Workers** → **Edit**
  - **Account** → **R2** → **Object Read & Write**
  - **Account** → **Account Settings** → **Read**
- Click "Create Token"
- **Copy the token** (starts with something like `abc123...`)

### 2. Cloudflare Account ID
- Go to: https://dash.cloudflare.com/
- Click on any domain (or go to Workers & Pages)
- Scroll down in the right sidebar
- Find **"Account ID"** (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- **Copy it**

## Automated Setup

Once you have those two values, run:

```bash
npm run setup-cloudflare -- --api-token=YOUR_TOKEN --account-id=YOUR_ACCOUNT_ID
```

Or set environment variables:

```bash
export CLOUDFLARE_API_TOKEN=your-token-here
export CLOUDFLARE_ACCOUNT_ID=your-account-id-here
npm run setup-cloudflare
```

## What the Script Does

The script will automatically:
- ✅ Create R2 bucket for screenshots
- ✅ Provide instructions for remaining manual steps
- ✅ Generate configuration values you'll need

## What Still Needs Manual Setup

Some things require manual setup in the Cloudflare dashboard:

1. **R2 API Token** (for uploads)
   - Dashboard → R2 → Manage R2 API Tokens
   - Create token with "Object Read & Write"
   - Save Access Key ID and Secret Access Key

2. **Upload Worker** (recommended for secure uploads)
   - Dashboard → Workers & Pages → Create Worker
   - Use code from `cloudflare-worker-upload-example.js`
   - Add R2 bucket binding

3. **Extension Hosting** (for auto-updates)
   - Dashboard → Workers & Pages → Pages
   - Connect to GitHub repository
   - Or use R2 for hosting

## After Setup

Once everything is set up, you'll need to:

1. **Update extension code** with your R2/Worker URLs
2. **Add GitHub Secrets** for auto-deployment
3. **Test** the setup

See `CLOUDFLARE_SETUP.md` for complete detailed instructions.

## Quick Command Reference

```bash
# Automated setup
npm run setup-cloudflare -- --api-token=TOKEN --account-id=ACCOUNT_ID

# Build and deploy
npm run build-update -- --extension-id=ID --update-url=URL

# Generate update.xml only
npm run generate-update-xml EXTENSION_ID VERSION DOWNLOAD_URL
```

