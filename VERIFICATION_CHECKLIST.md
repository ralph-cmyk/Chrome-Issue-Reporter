# Setup Verification Checklist

## ✅ What You've Completed

Based on our conversation, you've done:

1. ✅ **R2 Bucket Created**
   - Bucket name: `chrome-issue-reporter-screenshots`
   - Location: Eastern North America (ENAM)
   - Status: Created and accessible

2. ✅ **Upload Worker Deployed**
   - You mentioned posting code to Cloudflare
   - Worker should handle screenshot uploads to R2

3. ✅ **R2 Public Access Setup**
   - You were on the Settings page to enable it
   - Need to verify: Did you click "Enable" and get the public URL?

---

## 🔍 Verification Steps

### Step 1: Verify R2 Public URL

1. Go to: https://dash.cloudflare.com/6aff29174a263fec1dd8515745970ba3/r2/default/buckets/chrome-issue-reporter-screenshots
2. Click **"Settings"** tab
3. Scroll to **"Public Development URL"** section
4. **Check:** Is it enabled? If yes, copy the URL (format: `https://pub-6aff29174a263fec1dd8515745970ba3.r2.dev`)
5. **If not enabled:** Click "Enable" button and copy the URL

**Your UPDATE_BASE_URL should be:** `https://pub-6aff29174a263fec1dd8515745970ba3.r2.dev` (or similar)

---

### Step 2: Verify Upload Worker

1. Go to: https://dash.cloudflare.com/6aff29174a263fec1dd8515745970ba3/workers
2. **Check:** Do you see a worker named something like `chrome-issue-reporter-upload`?
3. **If yes:** Click on it and note the Worker URL (format: `https://chrome-issue-reporter-upload.your-account.workers.dev`)
4. **Verify R2 binding:**
   - In Worker settings, check "Variables and Secrets"
   - Should have binding: `SCREENSHOTS_BUCKET` → `chrome-issue-reporter-screenshots`

**Your Worker URL:** `https://________________.workers.dev`

---

### Step 3: Verify GitHub Secrets

Go to: https://github.com/ralph-cmyk/Chrome-Issue-Reporter/settings/secrets/actions

**Check if these secrets exist:**

- [ ] `CF_API_TOKEN` → Should be: `QcQgvgWGcjuPdSc1CaBinETVyl4ppUK62Mf1Zkee`
- [ ] `CF_ACCOUNT_ID` → Should be: `6aff29174a263fec1dd8515745970ba3`
- [ ] `CHROME_EXTENSION_ID` → ✅ Already exists (from Web Store workflow)
- [ ] `UPDATE_BASE_URL` → Should be your R2 public URL (from Step 1)
- [ ] `R2_BUCKET_NAME` → Should be: `chrome-issue-reporter-screenshots`

**If any are missing:** Add them using "New repository secret"

---

### Step 4: Verify Extension Configuration

1. Open Chrome and go to: `chrome://extensions/`
2. Find your extension and click **"Options"**
3. **Check R2 settings:**
   - [ ] **Worker Proxy URL** is set (from Step 2)
   - [ ] OR **R2 Public URL** is set (from Step 1)

---

## 🚀 Next Steps (After Verification)

### Immediate Next Steps:

1. **Add Missing GitHub Secrets**
   - If `UPDATE_BASE_URL` is missing, add it now
   - If `R2_BUCKET_NAME` is missing, add it now

2. **Update Upload Worker Code** (if needed)
   - Check if the Worker has the correct public URL in the code
   - The Worker should return URLs like: `https://pub-6aff29174a263fec1dd8515745970ba3.r2.dev/screenshots/...`
   - See `cloudflare-worker-upload-example.js` for reference

3. **Test the Workflow**
   - Make a small change to the code
   - Push to `main` branch
   - Check GitHub Actions: https://github.com/ralph-cmyk/Chrome-Issue-Reporter/actions
   - Verify the workflow runs successfully

4. **Configure Extension**
   - Open extension Options
   - Enter Worker Proxy URL (from Step 2)
   - Save settings

5. **Test Screenshot Upload**
   - Use the extension to create an issue
   - Verify screenshot uploads to R2
   - Check that the screenshot URL appears in the GitHub issue

---

## 📋 Quick Status Check

Run these commands to verify:

```bash
# Check if R2 bucket is accessible
curl -I https://pub-6aff29174a263fec1dd8515745970ba3.r2.dev/

# Test Worker (replace with your actual Worker URL)
curl -X POST https://your-worker.workers.dev \
  -F "screenshot=@test.jpg"
```

---

## ❓ What to Report Back

Please confirm:

1. ✅ R2 Public URL enabled? What is the URL?
2. ✅ Upload Worker deployed? What is the Worker URL?
3. ✅ Which GitHub secrets are missing (if any)?
4. ✅ Ready to test the workflow?

