# 🚀 Quick Deploy - Auto-Updates

**Get your extension auto-updating in 5 minutes!**

## One-Time Setup (Do Once)

### 1. Deploy Worker (2 minutes)

```bash
# Install Wrangler if you haven't
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Edit wrangler.toml - change bucket_name to your actual bucket
# Then deploy:
wrangler deploy
```

**Copy the URL you get!** It looks like:
```
https://chrome-issue-reporter-updates.YOUR-ACCOUNT.workers.dev
```

### 2. Update Extension (1 minute)

Edit `extension/manifest.json`:
```json
{
  "update_url": "https://chrome-issue-reporter-updates.YOUR-ACCOUNT.workers.dev/update.xml"
}
```

### 3. Configure GitHub Secrets (2 minutes)

Go to: **GitHub repo → Settings → Secrets → Actions**

Add these:
- `CHROME_EXTENSION_ID` = Your extension ID from chrome://extensions/
- `UPDATE_BASE_URL` = Your Worker URL (from step 1)
- `R2_BUCKET_NAME` = Your R2 bucket name
- `CF_ACCOUNT_ID` = Your Cloudflare account ID
- `R2_ACCESS_KEY_ID` = Your R2 access key
- `R2_SECRET_ACCESS_KEY` = Your R2 secret key

## Every Release (Automatic!)

Just update the version and push:

```bash
# Edit extension/manifest.json - bump the version
# Then commit and push
git add extension/manifest.json
git commit -m "Bump version to 21.0.1"
git push origin main
```

**That's it!** GitHub Actions will:
1. Build the extension
2. Upload to Cloudflare
3. Users get auto-updated within hours

## Test It Works

1. Push a version update
2. Wait for GitHub Action to complete
3. Visit: `https://your-worker-url.workers.dev/update.xml`
4. Should see XML with your new version!

## Files Created

- ✅ `cloudflare-worker-updates.js` - The Worker code
- ✅ `wrangler.toml` - Worker configuration
- ✅ `AUTO_UPDATE_SETUP.md` - Detailed setup guide
- ✅ `.env.example` - Environment variables template
- ✅ Extension now checks for updates automatically!

---

**Need more details?** See [AUTO_UPDATE_SETUP.md](AUTO_UPDATE_SETUP.md)
