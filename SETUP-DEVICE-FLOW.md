# GitHub Device Flow Setup Guide

This guide explains how to set up GitHub's Device Flow authentication for the Chrome Issue Reporter extension.

## What is Device Flow?

Device Flow is a special OAuth flow designed for devices without a web browser or with limited input capabilities. It's perfect for browser extensions because:
- ✅ No redirect URLs needed
- ✅ No client secrets required (safe for client-side apps)
- ✅ Simple user experience (just enter a code)
- ✅ More secure than traditional OAuth for extensions

## Why is Setup Required?

**The payload `client_id=Ov23liJyiD9bKVNz2X2w&scope=repo` is NOT enough by itself!**

Here's why:
1. **The Client ID must belong to a valid GitHub OAuth App**
2. **Device Flow must be explicitly enabled** for that OAuth App (it's OFF by default)
3. **Without these, GitHub returns a 404 error** when the extension tries to start the Device Flow

The default Client ID in the code (`Ov23liJyiD9bKVNz2X2w`) is just a placeholder. You must replace it with your own.

## Step-by-Step Setup

### 1. Create a GitHub OAuth App

1. Go to: https://github.com/settings/developers
2. Click **"New OAuth App"** (not "New GitHub App" - they're different!)
3. Fill in the form:
   ```
   Application name: Chrome Issue Reporter
   Homepage URL: https://github.com/ralph-cmyk/Chrome-Issue-Reporter
   Authorization callback URL: http://localhost
   ```
   **Note:** The callback URL is required by GitHub but not used by Device Flow
4. Click **"Register application"**

### 2. Enable Device Flow (CRITICAL!)

After creating the OAuth App:

1. Click on your app name to open its settings
2. Scroll down to find the **"Enable Device Flow"** checkbox
3. ✅ **Check the box** - This step is MANDATORY!
4. Click **"Update application"**

**⚠️ Common Mistake:** Many users miss this step because Device Flow is not enabled by default!

### 3. Copy Your Client ID

1. On the OAuth App settings page, find the **Client ID**
2. It should look like: `Ov23li...` (starts with "Ov23")
3. Copy it to your clipboard

### 4. Update the Extension

1. Open the extension folder on your computer
2. Edit `extension/background.js` in any text editor
3. Find this line (line 15):
   ```javascript
   const GITHUB_CLIENT_ID = 'Ov23liJyiD9bKVNz2X2w';
   ```
4. Replace it with your Client ID:
   ```javascript
   const GITHUB_CLIENT_ID = 'Ov23liYourClientIdHere';
   ```
5. Save the file

### 5. Reload the Extension

1. Open Chrome and go to: `chrome://extensions/`
2. Find "Chrome Issue Reporter"
3. Click the **🔄 Reload** button

### 6. Test the Setup

1. Right-click the extension icon → **Options**
2. Click **"Sign in with GitHub"**
3. You should see:
   - ✅ A verification code (e.g., "ABCD-1234")
   - ✅ A new tab opening to GitHub
4. Enter the code on GitHub and authorize
5. Success! 🎉

## Troubleshooting

### Problem: "404 Not Found" or "Failed to initiate device flow"

**Cause:** The OAuth App doesn't exist, Client ID is wrong, or Device Flow isn't enabled.

**Solution:**
1. Verify you created an **OAuth App** (not a GitHub App)
2. Check that **"Enable Device Flow"** is checked in the app settings
3. Confirm the Client ID in `background.js` matches your OAuth App
4. Reload the extension after making changes

**Test manually:**
```bash
# Replace YOUR_CLIENT_ID with your actual Client ID
curl -X POST https://github.com/login/device/code \
  -H "Accept: application/json" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID&scope=repo"
```

Expected response (success):
```json
{
  "device_code": "...",
  "user_code": "ABCD-1234",
  "verification_uri": "https://github.com/login/device",
  "expires_in": 900,
  "interval": 5
}
```

Error response (404):
```json
{
  "error": "Not Found"
}
```

### Problem: "Authorization pending" timeout

**Cause:** You didn't complete the authorization on GitHub within the time limit.

**Solution:**
1. Make sure you enter the verification code on GitHub
2. Click "Authorize" to approve the app
3. Codes expire after 15 minutes - try again if needed

### Problem: Extension doesn't reload changes

**Cause:** Chrome caches the old version.

**Solution:**
1. Go to `chrome://extensions/`
2. Toggle the extension OFF, then ON again
3. Or try removing and reinstalling the extension

## Understanding the OAuth Flow

Here's what happens when you click "Sign in with GitHub":

```
1. Extension → GitHub: POST /login/device/code
   Payload: client_id=YOUR_ID&scope=repo
   
2. GitHub → Extension: Returns device_code and user_code
   
3. Extension → You: Shows user_code (e.g., "ABCD-1234")
   
4. You → GitHub: Enter user_code and authorize
   
5. Extension → GitHub: POST /login/oauth/access_token (polling)
   Payload: client_id=YOUR_ID&device_code=...&grant_type=...
   
6. GitHub → Extension: Returns access_token
   
7. Extension: Saves token and you're signed in!
```

The key point: **Step 1 fails with 404 if Device Flow isn't enabled!**

## Why the Default Client ID Doesn't Work

The Client ID `Ov23liJyiD9bKVNz2X2w` in the code is:
- ❌ Just a placeholder/example
- ❌ May not have Device Flow enabled
- ❌ May not exist at all
- ❌ Shouldn't be shared publicly in production code

**You must create your own OAuth App and use your own Client ID.**

## Security Notes

✅ **Client IDs are public** - It's safe to commit them to your code
✅ **No client secrets needed** - Device Flow doesn't use secrets
✅ **Tokens are stored securely** - In Chrome's encrypted storage
✅ **Scopes are limited** - Only requests 'repo' scope (or what you specify)

❌ **Don't share access tokens** - These are private and grant API access
❌ **Don't commit .env files** - If you use environment variables for development

## Additional Resources

- [GitHub Device Flow Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [OAuth Apps vs GitHub Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)
- [Extension INSTALL.md](INSTALL.md) - Full installation guide
- [Extension OAUTH-FLOW.md](OAUTH-FLOW.md) - Technical implementation details

## Quick Reference

| What | Where | Example |
|------|-------|---------|
| Create OAuth App | https://github.com/settings/developers | Click "New OAuth App" |
| Enable Device Flow | OAuth App settings page | Check the "Enable Device Flow" box |
| Client ID | OAuth App settings page | `Ov23liYourClientIdHere` |
| Update Client ID | `extension/background.js` | Line 15: `const GITHUB_CLIENT_ID` |
| Reload Extension | chrome://extensions/ | Click 🔄 button |
| Test Sign In | Extension Options page | Click "Sign in with GitHub" |

---

**Got questions?** Open an issue on GitHub or check the troubleshooting sections in [INSTALL.md](INSTALL.md) and [OAUTH-FLOW.md](OAUTH-FLOW.md).
