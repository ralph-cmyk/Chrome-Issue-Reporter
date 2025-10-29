# Installation Guide - Chrome Issue Reporter

This guide provides multiple ways to install the Chrome Issue Reporter extension.

## Table of Contents
- [Method 1: Install from Pre-built ZIP (Recommended)](#method-1-install-from-pre-built-zip-recommended)
- [Method 2: Install from Source Code](#method-2-install-from-source-code)
- [Method 3: Build and Package Yourself](#method-3-build-and-package-yourself)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## Method 1: Install from Pre-built ZIP (Recommended)

This is the easiest method if you have a pre-built ZIP file of the extension.

### Step 1: Download the Extension

**Option A: From GitHub Releases**
1. Go to the [Releases page](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/releases)
2. Download the latest `chrome-issue-reporter-extension.zip` file
   - ⚠️ **IMPORTANT:** Download the file named `chrome-issue-reporter-extension.zip`
   - ❌ **DO NOT** download "Source code (zip)" or "Source code (tar.gz)" - these will NOT work!

**Option B: From a Direct Link**
- If someone provided you with a `chrome-issue-reporter-extension.zip` file, save it to your computer

### Step 2: Extract the ZIP File
1. Right-click on `chrome-issue-reporter-extension.zip`
2. Select "Extract All..." (Windows) or double-click (Mac)
3. Choose a permanent location for the extension folder (e.g., `Documents/ChromeExtensions/`)
4. **Important:** Do NOT delete this folder after installation - Chrome needs it to run the extension

### Step 3: Install in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** by toggling the switch in the top-right corner
3. Click the **Load unpacked** button
4. Navigate to the extracted folder (the one containing `manifest.json`)
5. Click **Select** (or **Open**)

✅ The extension is now installed!

### Step 4: Note Your Extension ID
After installation, Chrome assigns a unique ID to your extension (e.g., `abcdefghijklmnop...`). You'll need this for configuration.

Look for the ID below the extension name on the `chrome://extensions/` page.

---

## Method 2: Install from Source Code

If you cloned or downloaded the repository directly:

### Step 1: Get the Source Code
```bash
git clone https://github.com/ralph-cmyk/Chrome-Issue-Reporter.git
cd Chrome-Issue-Reporter
```

### Step 2: Install in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** in the top-right corner
3. Click **Load unpacked**
4. Navigate to and select the `extension` folder (not the root folder)
5. Click **Select**

✅ The extension is now installed!

---

## Method 3: Build and Package Yourself

If you want to create your own distributable ZIP file:

### Prerequisites
- Node.js installed (optional, for using npm scripts)
- OR basic command-line tools (zip)

### Using npm (Recommended)
```bash
# From the repository root
npm run package
```

This will create `chrome-issue-reporter-extension.zip` ready for distribution.

### Manual Packaging
```bash
# From the repository root
cd extension
zip -r ../chrome-issue-reporter-extension.zip *
```

Then follow [Method 1](#method-1-install-from-pre-built-zip-recommended) to install.

---

## Configuration

After installation, you must configure the extension with your GitHub OAuth App:

### Step 1: Create a GitHub OAuth App with Device Flow

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the details:
   - **Application name:** Chrome Issue Reporter (or your preferred name)
   - **Homepage URL:** `https://github.com/ralph-cmyk/Chrome-Issue-Reporter` (or your preferred URL)
   - **Authorization callback URL:** `http://localhost` (This is not used for Device Flow but is required by GitHub)
4. Click **Register application**
5. **IMPORTANT:** After creating the app, click on the app name to open its settings
6. Scroll down and find the **"Enable Device Flow"** checkbox
7. ✅ **Check "Enable Device Flow"** - This is REQUIRED for the extension to work!
8. Click **Update application**
9. Note your **Client ID** (starts with "Ov23...")

### Step 2: Update Extension Configuration

1. Navigate to the extension folder (the one you installed)
2. Open `background.js` in a text editor
3. Find this line (around line 11):
   ```javascript
   const GITHUB_CLIENT_ID = 'Ov23liJyiD9bKVNz2X2w';
   ```
4. Replace `'Ov23liJyiD9bKVNz2X2w'` with your own Client ID from Step 1
5. Save the file
6. Go to `chrome://extensions/` and click the **Reload** button for this extension

### Step 3: Sign In with GitHub

1. Right-click the extension icon in Chrome and select **Options**
2. Click **"Sign in with GitHub"**
3. You'll see a verification code (e.g., "ABCD-1234")
4. A new tab will open to GitHub's device authorization page
5. Enter the verification code shown in the extension
6. Click **Authorize** on GitHub
7. Return to the extension options page - you should see a success message

### Step 4: Configure Your Repository

1. After signing in, click **"Load My Repositories"** to fetch your repositories
2. Select a repository from the dropdown, or manually enter:
   - **Owner:** Your GitHub username or organization
   - **Repo:** Your repository name
   - **Labels:** (Optional) Comma-separated labels to add to issues
3. Click **Save Repository Settings**

---

## Troubleshooting

### Extension doesn't appear after installation
- Make sure Developer mode is enabled in `chrome://extensions/`
- Verify you selected the correct folder (it must contain `manifest.json`)
- Check the Chrome developer console for errors

### OAuth errors
- **"404 Not Found" or "Failed to start device flow":**
  - Your OAuth App might not exist or the Client ID is incorrect
  - Make sure you **enabled Device Flow** in your OAuth App settings (this is NOT enabled by default!)
  - Verify your Client ID in `background.js` matches the one from your OAuth App
  - Double-check that you created an **OAuth App** (not a GitHub App - they are different!)
- **"Authorization pending" timeout:**
  - Make sure you entered the verification code on GitHub within the time limit (usually 15 minutes)
  - Check that you clicked "Authorize" on GitHub
  - Try signing in again - you'll get a new verification code
- For OAuth changes, you may need to sign out and sign in again

### Extension is disabled on restart
- This is normal for unpacked extensions in Developer mode
- Chrome will show a warning banner - click "Dismiss" or disable the warning
- The extension will continue to work

### Cannot find manifest.json
- If using a ZIP file, make sure you extracted it fully
- The folder you select must directly contain `manifest.json`, not a subfolder

### Permission denied errors
- Make sure the extension folder is in a location you have write access to
- Avoid installing to system directories or read-only locations

### Updates not applying
- After changing any files, click the **Reload** button on `chrome://extensions/`
- For OAuth changes, you may need to sign out and sign in again

---

## Important Notes

### Developer Mode Warning
Chrome will show a warning that "Extensions running in Developer mode" may be disabled. This is normal for manually installed extensions. You can:
- Dismiss the warning each time Chrome starts
- Keep the extension enabled and working normally

### No Automatic Updates
Manually installed extensions do not auto-update. To update:
1. Download the new version
2. Extract to the same location (overwriting old files)
3. Click **Reload** on `chrome://extensions/`

### Security
- Only install extensions from trusted sources
- Review the code if you're unsure about the extension's behavior
- This extension requires access to GitHub APIs and page content for its functionality

---

## Next Steps

After installation:
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
