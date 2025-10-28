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
2. Download the latest `chrome-issue-reporter.zip` file

**Option B: From a Direct Link**
- If someone provided you with a `chrome-issue-reporter.zip` file, save it to your computer

### Step 2: Extract the ZIP File
1. Right-click on `chrome-issue-reporter.zip`
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

This will create `chrome-issue-reporter.zip` ready for distribution.

### Manual Packaging
```bash
# From the repository root
cd extension
zip -r ../chrome-issue-reporter.zip *
```

Then follow [Method 1](#method-1-install-from-pre-built-zip-recommended) to install.

---

## Configuration

After installation, you must configure the extension with your GitHub OAuth credentials:

### Step 1: Create a GitHub OAuth App

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the details:
   - **Application name:** Chrome Issue Reporter (or your preferred name)
   - **Homepage URL:** `http://localhost` (or your preferred URL)
   - **Authorization callback URL:** `https://<YOUR_EXTENSION_ID>.chromiumapp.org/`
     - Replace `<YOUR_EXTENSION_ID>` with the ID from Step 4 above
4. Click **Register application**
5. Note your **Client ID**

### Step 2: Update Extension Configuration

1. Navigate to the extension folder (the one you installed)
2. Open `background.js` in a text editor
3. Update these constants:
   ```javascript
   const CLIENT_ID = 'your_github_client_id_here';
   const REDIRECT_URI = 'https://YOUR_EXTENSION_ID.chromiumapp.org/';
   const GITHUB_SCOPES = 'public_repo';  // or 'repo' for private repos
   const DEFAULT_OWNER = 'your-github-username';
   const DEFAULT_REPO = 'your-repo-name';
   const DEFAULT_LABELS = ['bug'];  // or your preferred labels
   ```
4. Save the file
5. Go to `chrome://extensions/` and click the **Reload** button for this extension

### Step 3: Configure Options (Optional)

1. Right-click the extension icon in Chrome
2. Select **Options**
3. Update the default repository owner, repo name, and labels as needed
4. Click **Save**

### Step 4: Sign In

1. Click the extension icon in your Chrome toolbar
2. Click **Sign in with GitHub**
3. Follow the OAuth flow to authorize the extension
4. Choose the scope (public_repo or repo) based on your needs

---

## Troubleshooting

### Extension doesn't appear after installation
- Make sure Developer mode is enabled in `chrome://extensions/`
- Verify you selected the correct folder (it must contain `manifest.json`)
- Check the Chrome developer console for errors

### OAuth errors
- Verify your `CLIENT_ID` is correct
- Ensure the `REDIRECT_URI` matches your extension ID exactly
- Make sure your GitHub OAuth App has the correct callback URL

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
