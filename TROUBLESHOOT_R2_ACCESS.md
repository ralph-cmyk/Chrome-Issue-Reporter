# Troubleshooting R2 Access Denied Error

## The Problem

The workflow is getting `Access Denied` when trying to upload to R2. This means the R2 access keys don't have the right permissions.

## Solution: Verify R2 Access Key Permissions

### Step 1: Check R2 Access Key Permissions

1. Go to: https://dash.cloudflare.com/6aff29174a263fec1dd8515745970ba3/r2/manage/api-tokens
2. Find your R2 API token (the one with Access Key ID: `38142b72ea8ec8343fe80526339e6f9c`)
3. **Check permissions:**
   - Should have: **"Object Read & Write"** or **"Admin Read & Write"**
   - If it only has "Read", you need to create a new token with write permissions

### Step 2: Create New R2 API Token (if needed)

If your current token doesn't have write permissions:

1. Go to: https://dash.cloudflare.com/6aff29174a263fec1dd8515745970ba3/r2/manage/api-tokens
2. Click **"Create API token"**
3. Configure:
   - **Permissions:** "Object Read & Write" or "Admin Read & Write"
   - **TTL:** (optional, leave blank for no expiration)
4. Click **"Create API token"**
5. **Copy the Access Key ID and Secret Access Key**
6. Update GitHub secrets:
   - `R2_ACCESS_KEY_ID` → New Access Key ID
   - `R2_SECRET_ACCESS_KEY` → New Secret Access Key

### Step 3: Verify Bucket Name

Make sure the `R2_BUCKET_NAME` secret matches exactly:
- Should be: `chrome-issue-reporter-screenshots`
- Check: https://github.com/ralph-cmyk/Chrome-Issue-Reporter/settings/secrets/actions

### Step 4: Test Locally (Optional)

You can test the credentials locally:

```bash
# Set environment variables
export AWS_ACCESS_KEY_ID="38142b72ea8ec8343fe80526339e6f9c"
export AWS_SECRET_ACCESS_KEY="f34b352a18e31839b9e66cb639fa3234201000085d17f513328e2ca9ee7b5784"

# Test upload
aws s3 cp test.txt \
  s3://chrome-issue-reporter-screenshots/test.txt \
  --endpoint-url https://6aff29174a263fec1dd8515745970ba3.r2.cloudflarestorage.com \
  --region auto
```

If this fails locally, the credentials don't have write permissions.

## After Fixing

Once you've updated the R2 access keys with write permissions:

1. Update the GitHub secrets with the new keys
2. Re-run the workflow:
   ```bash
   gh workflow run deploy-to-cloudflare.yml
   ```

The workflow should now succeed!

