# Cloudflare Credentials and Configuration Needed

## Required Credentials and Variables

### 1. Cloudflare R2 (Screenshot Storage)

**What you need:**
- **R2 Bucket Name** - e.g., `chrome-issue-reporter-screenshots`
- **R2 Account ID** - Found in Cloudflare Dashboard → R2 → Overview
- **R2 Access Key ID** - Create via R2 → Manage R2 API Tokens
- **R2 Secret Access Key** - Generated when creating API token (save immediately, can't view again)
- **R2 Public URL** - Custom domain or R2.dev subdomain (e.g., `https://screenshots.yourdomain.com` or `https://pub-xxxxx.r2.dev`)

**How to get:**
1. Go to Cloudflare Dashboard → R2
2. Create a bucket (note the name)
3. Go to "Manage R2 API Tokens" → "Create API Token"
4. Select "Object Read & Write" permissions
5. Copy Access Key ID and Secret Access Key (save secret immediately!)

**Where used:**
- Extension code: Upload screenshots to R2
- Environment variables or extension config

---

### 2. Cloudflare Workers/Pages (Extension Hosting)

**What you need:**
- **Workers/Pages Project Name** - e.g., `chrome-issue-reporter-updates`
- **Workers.dev Subdomain** - e.g., `chrome-issue-reporter-updates.your-account.workers.dev`
- **Custom Domain (Optional)** - e.g., `updates.yourdomain.com`
- **Cloudflare API Token** - For deploying via GitHub Actions (optional, for automation)

**How to get:**
1. Go to Cloudflare Dashboard → Workers & Pages
2. Create a new Worker or Pages project
3. Note the workers.dev URL (or configure custom domain)
4. For API token: Account → API Tokens → Create Token (with Workers:Edit permissions)

**Where used:**
- Host extension ZIP files
- Host `update.xml` file
- Chrome checks this URL for updates

---

### 3. Extension Configuration

**What you need:**
- **Extension ID** - 32-character string (e.g., `abcdefghijklmnopqrstuvwxyz123456`)
  - If not published: Generate one or use a placeholder
  - If published: Get from Chrome Web Store Developer Dashboard
- **Extension Version** - Current version from `manifest.json` (e.g., `21.0.0`)

**How to get Extension ID:**
- **If published:** Chrome Web Store → Developer Dashboard → Your Extension → ID
- **If not published:** 
  - Load extension in developer mode
  - Go to `chrome://extensions/`
  - Enable "Developer mode"
  - Find your extension → Copy "ID"

**Where used:**
- `update.xml` file (Chrome uses this to identify your extension)
- `manifest.json` (if you want to set a specific ID)

---

## Environment Variables / Configuration

### For Extension Code (background.js)

These can be:
- **Option A:** Hardcoded constants (simpler, less secure)
- **Option B:** Stored in `chrome.storage` (user configurable)
- **Option C:** Environment variables (for build process)

**Required values:**
```javascript
// R2 Configuration
const R2_ENDPOINT = 'https://<account-id>.r2.cloudflarestorage.com';
const R2_BUCKET_NAME = 'chrome-issue-reporter-screenshots';
const R2_ACCESS_KEY_ID = 'your-access-key-id';
const R2_SECRET_ACCESS_KEY = 'your-secret-access-key';
const R2_PUBLIC_URL = 'https://screenshots.yourdomain.com'; // or R2.dev URL

// Update URL
const UPDATE_URL = 'https://chrome-issue-reporter-updates.your-account.workers.dev/update.xml';
```

### For Build Scripts (package.json / scripts)

**Required values:**
```bash
# R2 Upload (for screenshots)
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET_NAME=chrome-issue-reporter-screenshots
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key

# Extension Hosting
CF_ACCOUNT_ID=your-cloudflare-account-id
CF_API_TOKEN=your-cloudflare-api-token
WORKERS_PROJECT_NAME=chrome-issue-reporter-updates
UPDATE_BASE_URL=https://chrome-issue-reporter-updates.your-account.workers.dev

# Extension Info
EXTENSION_ID=abcdefghijklmnopqrstuvwxyz123456
```

---

## Security Recommendations

### Where to Store Credentials

1. **Extension Code (background.js):**
   - ❌ **Don't:** Hardcode R2 secret keys in extension code (users can see it)
   - ✅ **Do:** Use R2 public URL with pre-signed URLs OR
   - ✅ **Do:** Create a Cloudflare Worker proxy that handles uploads (keeps secrets server-side)

2. **Build Scripts:**
   - ✅ Store in `.env` file (add to `.gitignore`)
   - ✅ Use GitHub Secrets for CI/CD
   - ✅ Never commit secrets to repository

3. **Recommended Approach:**
   - **Option 1 (Simplest):** Use R2 public bucket with CORS, generate pre-signed URLs from a Worker
   - **Option 2 (More Secure):** Extension uploads to Cloudflare Worker → Worker uploads to R2 (keeps secrets server-side)

---

## Setup Checklist

### Phase 1: R2 Setup
- [ ] Create R2 bucket
- [ ] Configure bucket for public access
- [ ] Set up CORS rules
- [ ] Create lifecycle rule (14-day deletion)
- [ ] Create API token (Access Key ID + Secret)
- [ ] Note bucket name and account ID
- [ ] Set up public URL (custom domain or R2.dev)

### Phase 2: Workers/Pages Setup
- [ ] Create Workers or Pages project
- [ ] Note workers.dev URL
- [ ] (Optional) Configure custom domain
- [ ] (Optional) Create API token for deployments

### Phase 3: Extension Configuration
- [ ] Get or generate Extension ID
- [ ] Note current extension version
- [ ] Decide on credential storage approach
- [ ] Set up environment variables or config

### Phase 4: Testing
- [ ] Test R2 upload from extension
- [ ] Verify public URLs work
- [ ] Test 14-day deletion
- [ ] Test update.xml accessibility
- [ ] Test auto-update mechanism

---

## Example .env File

Create a `.env` file in project root (add to `.gitignore`):

```bash
# Cloudflare R2
R2_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
R2_BUCKET_NAME=chrome-issue-reporter-screenshots
R2_ACCESS_KEY_ID=your-access-key-id-here
R2_SECRET_ACCESS_KEY=your-secret-access-key-here
R2_PUBLIC_URL=https://screenshots.yourdomain.com

# Cloudflare Workers/Pages
CF_ACCOUNT_ID=your-cloudflare-account-id
CF_API_TOKEN=your-cloudflare-api-token
WORKERS_PROJECT_NAME=chrome-issue-reporter-updates
UPDATE_BASE_URL=https://chrome-issue-reporter-updates.your-account.workers.dev

# Extension
EXTENSION_ID=abcdefghijklmnopqrstuvwxyz123456
```

---

## GitHub Secrets (for CI/CD)

If using GitHub Actions for automated deployments:

1. Go to Repository → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `CF_API_TOKEN`
   - `EXTENSION_ID`

---

## Quick Reference: Where Each Value is Used

| Value | Used In | Purpose |
|-------|---------|---------|
| R2 Bucket Name | Extension code, build scripts | Where screenshots are stored |
| R2 Access Key ID | Extension code, build scripts | Authenticate R2 uploads |
| R2 Secret Access Key | Extension code, build scripts | Authenticate R2 uploads |
| R2 Public URL | Extension code | Generate public screenshot URLs |
| Workers.dev URL | manifest.json, update.xml | Chrome checks here for updates |
| Extension ID | update.xml, manifest.json | Chrome identifies your extension |
| CF API Token | Build scripts (optional) | Deploy to Workers/Pages via API |

