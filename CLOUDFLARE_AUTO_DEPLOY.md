# Cloudflare Auto-Deploy Setup

This guide shows you how to set up automatic deployment to Cloudflare when you push changes to your repository.

## Option 1: GitHub Actions (Recommended)

GitHub Actions can automatically build and deploy your extension to Cloudflare whenever you push to the main branch.

### Setup Steps

1. **Add GitHub Secrets**

   Go to your repository → Settings → Secrets and variables → Actions → New repository secret

   Add these secrets:
   - `CF_API_TOKEN` - Cloudflare API token (see below)
   - `CF_ACCOUNT_ID` - Your Cloudflare account ID
   - `EXTENSION_ID` - Your Chrome extension ID
   - `UPDATE_BASE_URL` - Your Cloudflare Workers/Pages URL (e.g., `https://chrome-issue-reporter-updates.your-account.workers.dev`)
   - `R2_BUCKET_NAME` - Your R2 bucket name (if using R2 for hosting)

2. **Get Cloudflare API Token**

   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - Click "Create Token"
   - Use "Edit Cloudflare Workers" template
   - Add permissions:
     - Account → Cloudflare Workers → Edit
     - Account → Account Settings → Read
     - Zone → Zone Settings → Read (if using custom domain)
   - Add R2 permissions:
     - Account → R2 → Object Read & Write
   - Click "Continue to summary" → "Create Token"
   - Copy the token (you won't see it again!)

3. **Get Cloudflare Account ID**

   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Click on any domain (or go to Workers & Pages)
   - Scroll down to find "Account ID" in the right sidebar
   - Copy it

4. **Workflow is Ready**

   The workflow (`.github/workflows/deploy-to-cloudflare.yml`) will automatically:
   - Build the extension
   - Generate `update.xml`
   - Upload extension ZIP to Cloudflare R2
   - Upload `update.xml` to Cloudflare R2
   - Create a GitHub release

   **Trigger:** Pushes to `main` branch automatically trigger deployment

## Option 2: Cloudflare Pages (GitHub Integration)

Cloudflare Pages can automatically deploy when you push to GitHub.

### Setup Steps

1. **Connect Repository to Cloudflare Pages**

   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages
   - Click "Create application" → "Pages" → "Connect to Git"
   - Select your GitHub repository
   - Authorize Cloudflare to access your repository

2. **Configure Build Settings**

   - **Project name:** `chrome-issue-reporter-updates`
   - **Production branch:** `main`
   - **Build command:** `npm run build && npm run package`
   - **Build output directory:** `.` (root)
   - **Root directory:** `/` (root)

3. **Set Environment Variables**

   In Pages settings → Environment variables, add:
   - `EXTENSION_ID` - Your extension ID
   - `UPDATE_BASE_URL` - Your Pages URL

4. **Custom Build Script (Optional)**

   Create `_redirects` file in root for proper routing:
   ```
   /extensions/*  /extensions/:splat  200
   /update.xml    /update.xml         200
   ```

5. **Deploy**

   - Cloudflare Pages will automatically build and deploy on every push to `main`
   - Extension ZIPs need to be uploaded manually or via GitHub Actions

## Option 3: Hybrid Approach (Recommended)

Use **GitHub Actions** to build and upload files, and **Cloudflare Pages** to serve them.

### Workflow

1. **GitHub Actions** (on push to main):
   - Builds extension
   - Generates `update.xml`
   - Uploads ZIP and `update.xml` to Cloudflare R2
   - Creates GitHub release

2. **Cloudflare Pages** (connected to GitHub):
   - Serves static files from R2 or repository
   - Handles routing for `update.xml` and extension ZIPs

### Setup

1. Set up GitHub Actions (Option 1)
2. Set up Cloudflare Pages (Option 2)
3. Configure Pages to serve files from R2 or sync from repository

## Manual Deployment

If you prefer manual control, you can deploy manually:

```bash
# Build and package
npm run build-update -- --extension-id=YOUR_EXTENSION_ID --update-url=YOUR_WORKERS_URL

# Upload to Cloudflare R2 using Wrangler CLI
npx wrangler r2 object put r2://your-bucket/extensions/chrome-issue-reporter-v21.0.0.zip --file=chrome-issue-reporter-v21.0.0.zip
npx wrangler r2 object put r2://your-bucket/update.xml --file=update.xml
```

## Testing Auto-Deploy

1. Make a small change to the extension
2. Commit and push to `main` branch
3. Check GitHub Actions tab to see deployment progress
4. Verify files are uploaded to Cloudflare
5. Test extension update mechanism

## Troubleshooting

### GitHub Actions Fails

- Check that all secrets are set correctly
- Verify Cloudflare API token has correct permissions
- Check workflow logs for specific errors

### Files Not Uploading

- Verify R2 bucket name is correct
- Check API token has R2 permissions
- Ensure account ID is correct

### Update Not Working

- Verify `update.xml` is accessible at the URL
- Check extension ID matches in `update.xml` and manifest
- Ensure ZIP file is accessible at the download URL

## Required GitHub Secrets

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `CF_API_TOKEN` | Cloudflare API token | Cloudflare Dashboard → Profile → API Tokens |
| `CF_ACCOUNT_ID` | Cloudflare account ID | Cloudflare Dashboard → Right sidebar |
| `EXTENSION_ID` | Chrome extension ID | `chrome://extensions/` in developer mode |
| `UPDATE_BASE_URL` | Workers/Pages URL | Your deployed Workers or Pages URL |
| `R2_BUCKET_NAME` | R2 bucket name | Your R2 bucket name (if using R2 for hosting) |

## Workflow Customization

The workflow can be customized:

- **Trigger on tags:** Change `on.push.branches` to `on.push.tags`
- **Manual only:** Remove `on.push`, keep only `workflow_dispatch`
- **Different branch:** Change `main` to your preferred branch
- **Skip release:** Remove the "Create GitHub Release" step

See `.github/workflows/deploy-to-cloudflare.yml` for the full workflow.

