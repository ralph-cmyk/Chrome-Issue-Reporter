# Installation Guide - Chrome Issue Reporter

This guide shows you how to install and configure the Chrome Issue Reporter extension.

## Installation

### Install from Chrome Web Store (Recommended)

The easiest way to install Chrome Issue Reporter is directly from the Chrome Web Store:

1. Visit the [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for "Chrome Issue Reporter"
3. Click **Add to Chrome**
4. Confirm by clicking **Add extension**

✅ The extension is now installed and will auto-update when new versions are released!

**Benefits of Chrome Web Store Installation:**
- ✅ Automatic updates
- ✅ No developer mode warnings
- ✅ Simple one-click installation
- ✅ Verified by Google

---

### Manual Installation from ZIP (When Chrome Web Store Not Available)

If the extension is not yet on Chrome Web Store, you can install it manually from a ZIP file:

1. **Download the ZIP file** from the [latest GitHub Release](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/releases/latest)

2. **Extract the ZIP file** to a folder on your computer
   - Right-click the ZIP file and select "Extract All..." (Windows)
   - Or double-click the ZIP file (Mac)
   - Remember the folder location

3. **Open Chrome Extensions page:**
   - Navigate to `chrome://extensions/`
   - Or click the menu (⋮) → More tools → Extensions

4. **Enable Developer Mode:**
   - Toggle the "Developer mode" switch in the top-right corner

5. **Load the extension:**
   - Click **Load unpacked**
   - Navigate to the folder where you extracted the ZIP
   - Select the folder and click **Select Folder**

6. **Note the Extension ID:**
   - After loading, you'll see an Extension ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)
   - You'll need this for the OAuth callback URL in the next steps

⚠️ **Manual installations require Developer mode and show a warning banner.** This is normal for extensions not installed from the Chrome Web Store. Once the extension is published to Chrome Web Store, you can install it from there instead.

---

## Configuration

After installation, you must configure the extension with your GitHub OAuth App:

### Step 1: Create a GitHub OAuth App

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the details:
   - **Application name:** Chrome Issue Reporter (or your preferred name)
   - **Homepage URL:** `https://github.com/ralph-cmyk/Chrome-Issue-Reporter` (or your preferred URL)
   - **Authorization callback URL:** `https://<your-extension-id>.chromiumapp.org/`
     - To find your extension ID: Go to `chrome://extensions/` and look for the ID under the extension name
     - Example: `https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org/`
4. Click **Register application**
5. Note your **Client ID** (starts with "Ov23...")

### Step 2: Configure the Extension

1. Right-click the extension icon in Chrome and select **Options**
2. Enter your GitHub OAuth App **Client ID** from Step 1
3. Click **Save**

### Step 3: Sign In with GitHub

1. In the extension **Options** page, click **"Sign in with GitHub"**
2. You'll see a verification code (e.g., "ABCD-1234")
3. A new tab will open to GitHub's device authorization page
4. Enter the verification code shown in the extension
5. Click **Authorize** on GitHub
6. Return to the extension options page - you should see a success message

### Step 4: Configure Your Repository

1. After signing in, click **"Load My Repositories"** to fetch your repositories
2. Select a repository from the dropdown, or manually enter:
   - **Owner:** Your GitHub username or organization
   - **Repo:** Your repository name
   - **Labels:** (Optional) Comma-separated labels to add to issues
3. Click **Save Repository Settings**

---

## For Developers: Development Installation

If you're developing or contributing to this extension, you can install it locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/ralph-cmyk/Chrome-Issue-Reporter.git
   cd Chrome-Issue-Reporter
   ```

2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** in the top-right corner
4. Click **Load unpacked**
5. Navigate to and select the `extension` folder (not the root folder)
6. Click **Select**

⚠️ **Note:** Development installations require Developer mode and will show a warning banner. For regular use, install from the Chrome Web Store.

---

## Troubleshooting

### OAuth errors
- **"404 Not Found" or "Failed to start device flow":**
  - Your OAuth App might not exist or the Client ID is incorrect
  - Verify your Client ID in the extension options matches the one from your OAuth App
  - Double-check that you created an **OAuth App** (not a GitHub App - they are different!)
  - Make sure the callback URL uses your extension ID: `https://<extension-id>.chromiumapp.org/`

- **"Authorization pending" timeout:**
  - Make sure you entered the verification code on GitHub within the time limit (usually 15 minutes)
  - Check that you clicked "Authorize" on GitHub
  - Try signing in again - you'll get a new verification code

### Extension not working
- Make sure you've completed all configuration steps
- Check that you're signed in to GitHub in the extension options
- Verify that a repository is configured
- Try signing out and signing in again

### Permission denied errors when creating issues
- Ensure you have write access to the repository you've configured
- Check that your GitHub token hasn't expired (sign in again if needed)
- Verify the repository owner and name are correct

---

## Next Steps

After installation and configuration:
1. Right-click any page and select **Create GitHub Issue from Page/Selection**
2. The extension will capture the page context
3. Edit the issue title and body in the popup
4. Submit directly to GitHub

For more details on usage, see the main [README.md](README.md).

---

## Need Help?

- Check the [main README](README.md) for feature documentation
- Review the [GitHub Issues](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/issues) for known problems
- Open a new issue if you encounter problems
