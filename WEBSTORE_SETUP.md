# Chrome Web Store Publishing Setup

This document explains how to set up automatic publishing to the Chrome Web Store via GitHub Actions.

## ⚠️ Important: First-Time Manual Submission Required

**Before this automated workflow can function, you MUST manually upload and publish your extension to the Chrome Web Store at least once.** The automated publishing only works for updating existing extensions.

If you haven't published your extension yet, skip to the "First-Time Manual Submission" section in the Troubleshooting area at the bottom of this document.

## Prerequisites

1. A published extension on the Chrome Web Store
2. Access to the Google Cloud Console
3. Repository admin access to configure GitHub Secrets

## Setup Steps

### 1. Get Chrome Web Store Extension ID

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Find your extension
3. Copy the **Extension ID** (it's a 32-character string)
4. Save this for later - you'll add it as `CHROME_EXTENSION_ID` secret

### 2. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Chrome Web Store API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Chrome Web Store API"
   - Click "Enable"

### 3. Create OAuth 2.0 Credentials

1. In Google Cloud Console, go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Add authorized redirect URI: `http://localhost`
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**
7. Save these for later

### 4. Generate Refresh Token

You need to get a refresh token by authorizing the OAuth application:

#### Option A: Using Chrome Web Store API Script

```bash
# Clone the repository
git clone https://github.com/fregante/chrome-webstore-upload-cli
cd chrome-webstore-upload-cli

# Install dependencies
npm install

# Get refresh token (replace with your values)
npx chrome-webstore-upload-cli authorize \
  --client-id="YOUR_CLIENT_ID" \
  --client-secret="YOUR_CLIENT_SECRET"
```

Follow the instructions in your terminal. This will:
1. Open a browser window
2. Ask you to authorize the application
3. Return a refresh token

#### Option B: Manual Process

1. Visit this URL (replace `YOUR_CLIENT_ID` with your actual client ID):
   ```
   https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost
   ```

2. Authorize the application
3. You'll be redirected to `http://localhost/?code=AUTHORIZATION_CODE`
4. Copy the `AUTHORIZATION_CODE` from the URL

5. Exchange the authorization code for a refresh token:
   ```bash
   curl -X POST https://oauth2.googleapis.com/token \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "code=AUTHORIZATION_CODE" \
     -d "grant_type=authorization_code" \
     -d "redirect_uri=http://localhost"
   ```

6. Save the `refresh_token` from the response

### 5. Configure GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret" and add:
   - **Name:** `CHROME_EXTENSION_ID`
     - **Value:** Your 32-character extension ID from step 1
   - **Name:** `CHROME_CLIENT_ID`
     - **Value:** OAuth client ID from step 3
   - **Name:** `CHROME_CLIENT_SECRET`
     - **Value:** OAuth client secret from step 3
   - **Name:** `CHROME_REFRESH_TOKEN`
     - **Value:** Refresh token from step 4

## Workflow Operation

Once configured, the workflow will:

1. **Trigger:** Automatically run when code is pushed to the `main` branch
2. **Build:** Build the extension from source
3. **Publish:** Upload and publish the new version to Chrome Web Store
4. **Release:** Create a GitHub release with version information

## Testing

To test the workflow:

1. Make a change to your extension (e.g., update version in `manifest.json`)
2. Commit and push to `main` branch:
   ```bash
   git add extension/manifest.json
   git commit -m "Bump version to X.Y.Z"
   git push origin main
   ```
3. Watch the workflow run in GitHub Actions
4. Check Chrome Web Store Developer Dashboard - your extension should be updated

## Automatic Updates for Users

Once published via the Chrome Web Store:

- **Update Frequency:** Chrome checks for updates every few hours (typically 5-6 hours)
- **User Experience:** Users receive updates automatically in the background
- **No User Action Required:** Updates install silently without user interaction

## Troubleshooting

### "Response code 404 (Not Found)" error

This is the most common error and typically means:

1. **Extension not yet published** (MOST COMMON)
   - The extension must be **manually submitted and published** to Chrome Web Store first
   - Automated publishing only works for updating existing extensions
   - See "First-Time Manual Submission" section below

2. **Incorrect Extension ID**
   - Verify `CHROME_EXTENSION_ID` matches your published extension
   - Get the correct ID from Chrome Web Store Developer Dashboard
   - Extension IDs are 32 characters long (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

3. **Extension removed or suspended**
   - Check Chrome Web Store Developer Dashboard for extension status
   - Ensure the extension hasn't been removed or suspended

### First-Time Manual Submission

**⚠️ IMPORTANT:** Before automated publishing can work, you MUST manually submit the extension once:

1. Build the extension:
   ```bash
   npm run build
   npm run package
   ```

2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

3. Click "New Item" and upload the ZIP file

4. Fill in all required store listing information:
   - Name, description, screenshots
   - Category and language
   - Privacy policy URL

5. Submit for review and wait for approval

6. Once published, copy the Extension ID

7. Configure GitHub secrets (see section 5 above)

8. Now automated publishing will work on future updates!

### "Invalid refresh token" error
- The refresh token may have expired
- Re-generate the refresh token using step 4
- Update the `CHROME_REFRESH_TOKEN` secret

### "Extension not found" error
- Check that `CHROME_EXTENSION_ID` is correct
- Ensure the extension is published on the Chrome Web Store
- Verify the Google account has access to the extension

### "API not enabled" error
- Ensure Chrome Web Store API is enabled in Google Cloud Console
- Make sure you're using the correct Google Cloud project

### Workflow fails on publish step
- Check that all four secrets are configured correctly
- Verify the OAuth credentials are valid
- Check Chrome Web Store Developer Dashboard for any policy violations

## Security Notes

- **Never commit secrets to the repository**
- Store all credentials only in GitHub Secrets
- Refresh tokens do not expire but can be revoked
- Regularly audit access to your Google Cloud project
- Consider using different credentials for development and production

## References

- [Chrome Web Store API Documentation](https://developer.chrome.com/docs/webstore/using_webstore_api/)
- [chrome-webstore-upload-cli](https://github.com/fregante/chrome-webstore-upload-cli)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
