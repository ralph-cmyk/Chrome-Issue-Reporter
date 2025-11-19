# Fix: 403 Forbidden Error

## The Problem

The workflow is getting a `403: Forbidden` error because the Cloudflare API token doesn't have R2 write permissions.

## Solution: Create New API Token with R2 Permissions

### Step 1: Create New API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Click **"Create Custom Token"**
4. Configure:
   - **Token name:** `GitHub Actions R2 Deploy`
   - **Permissions:**
     - **Account** → **Cloudflare R2** → **Edit**
   - **Account Resources:**
     - **Include** → **Specific account** → Select your account
   - **Zone Resources:** (leave as default)
5. Click **"Continue to summary"**
6. Click **"Create Token"**
7. **Copy the token immediately** (you won't see it again!)

### Step 2: Update GitHub Secret

1. Go to: https://github.com/ralph-cmyk/Chrome-Issue-Reporter/settings/secrets/actions
2. Find `CF_API_TOKEN`
3. Click **"Update"**
4. Paste the new token
5. Click **"Update secret"**

### Step 3: Re-run Workflow

The workflow will automatically run on the next push, or you can trigger it manually:
```bash
gh workflow run deploy-to-cloudflare.yml
```

## ✅ FIXED: Using R2 Access Keys Instead

I've updated the workflow to use your R2 Access Keys via the S3-compatible API instead of the API token. This avoids the permission issue.

### Add These GitHub Secrets

1. Go to: https://github.com/ralph-cmyk/Chrome-Issue-Reporter/settings/secrets/actions
2. Add these two secrets:

   **Secret 1:**
   - **Name:** `R2_ACCESS_KEY_ID`
   - **Value:** `38142b72ea8ec8343fe80526339e6f9c`

   **Secret 2:**
   - **Name:** `R2_SECRET_ACCESS_KEY`
   - **Value:** `f34b352a18e31839b9e66cb639fa3234201000085d17f513328e2ca9ee7b5784`

3. Click **"Add secret"** for each

### Re-run Workflow

After adding the secrets, the workflow will work! You can trigger it:
```bash
gh workflow run deploy-to-cloudflare.yml
```

---

## Alternative: Fix API Token (if you prefer)

If you want to use the API token approach instead, create a new token with R2 permissions (see original instructions above).

