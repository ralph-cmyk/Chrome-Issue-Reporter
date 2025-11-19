# How to Find Your UPDATE_BASE_URL

## Option 1: Using R2 Public URL (Current Setup)

Your workflow uploads extension files directly to R2. The `UPDATE_BASE_URL` should be your R2 public URL.

### Steps:

1. **Go to your R2 bucket:**
   - Direct link: https://dash.cloudflare.com/6aff29174a263fec1dd8515745970ba3/r2
   - Click on bucket: `chrome-issue-reporter-screenshots`

2. **Enable Public Access:**
   - Go to **Settings** → **Public Access**
   - Click **"Allow Access"** or **"Enable Public Access"**
   - Note the public URL shown (format: `https://pub-6aff29174a263fec1dd8515745970ba3.r2.dev`)

3. **Your UPDATE_BASE_URL is:**
   ```
   https://pub-6aff29174a263fec1dd8515745970ba3.r2.dev
   ```
   (Replace with your actual public URL if different)

4. **Verify it works:**
   - After the GitHub Actions workflow runs, you should be able to access:
   - `https://pub-6aff29174a263fec1dd8515745970ba3.r2.dev/update.xml`
   - `https://pub-6aff29174a263fec1dd8515745970ba3.r2.dev/extensions/chrome-issue-reporter-v21.0.0.zip`

---

## Option 2: Using Cloudflare Pages (Alternative)

If you deployed to Cloudflare Pages instead:

1. **Go to Cloudflare Pages:**
   - Direct link: https://dash.cloudflare.com/6aff29174a263fec1dd8515745970ba3/pages
   - Find your project: `chrome-issue-reporter-updates`

2. **Your UPDATE_BASE_URL is:**
   ```
   https://chrome-issue-reporter-updates.pages.dev
   ```
   (Or your custom domain if configured)

3. **Enable the Pages deployment in workflow:**
   - Edit `.github/workflows/deploy-to-cloudflare.yml`
   - Change line 74: `if: false` → `if: true`

---

## Option 3: Using Cloudflare Worker

If you deployed a Worker to serve files:

1. **Go to Workers:**
   - Direct link: https://dash.cloudflare.com/6aff29174a263fec1dd8515745970ba3/workers
   - Find your worker

2. **Your UPDATE_BASE_URL is:**
   ```
   https://your-worker-name.your-account.workers.dev
   ```

---

## Quick Check: What Did You Deploy?

**If you deployed the upload worker** (`cloudflare-worker-upload-example.js`):
- That's for screenshot uploads only
- You still need R2 public URL for `UPDATE_BASE_URL`

**If you deployed to Pages:**
- Use the Pages URL as `UPDATE_BASE_URL`

**If you're using R2 directly (current workflow setup):**
- Use the R2 public URL as `UPDATE_BASE_URL`

---

## After Finding Your URL

1. Add it to GitHub Secrets:
   - Go to: https://github.com/ralph-cmyk/Chrome-Issue-Reporter/settings/secrets/actions
   - Secret name: `UPDATE_BASE_URL`
   - Value: Your URL (e.g., `https://pub-6aff29174a263fec1dd8515745970ba3.r2.dev`)

2. Test it:
   - After the workflow runs, visit: `{YOUR_UPDATE_BASE_URL}/update.xml`
   - You should see the update manifest XML

