# Quick Start Guide

Get started with Chrome Issue Reporter in just a few minutes!

## 📥 Installation (2 minutes)

### Step 1: Get the Extension
Download `chrome-issue-reporter-extension.zip` from [Releases](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/releases)

> ⚠️ **Important:** Download `chrome-issue-reporter-extension.zip`, NOT the source code archives!

### Step 2: Extract
Unzip the file to a **permanent location** (e.g., `Documents/ChromeExtensions/`)

> ⚠️ Don't delete this folder - Chrome needs it!

### Step 3: Load in Chrome
1. Open Chrome → `chrome://extensions/`
2. Toggle **Developer mode** (top-right) → ON
3. Click **Load unpacked**
4. Select the extracted folder
5. ✅ Done!

## ⚙️ Configuration (5 minutes)

### Step 1: Create GitHub OAuth App
1. Go to: https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in:
   - **Name:** Chrome Issue Reporter
   - **Homepage:** http://localhost
   - **Callback URL:** `https://YOUR_EXTENSION_ID.chromiumapp.org/`
     - Find YOUR_EXTENSION_ID in `chrome://extensions/` under the extension
4. Save and copy your **Client ID**

### Step 2: Configure Extension
1. Open the extracted folder
2. Edit `background.js` in a text editor
3. Replace these values (around line 3-8):
   ```javascript
   const CLIENT_ID = 'paste_your_client_id_here';
   const REDIRECT_URI = 'https://YOUR_EXTENSION_ID.chromiumapp.org/';
   const GITHUB_SCOPES = 'public_repo';  // or 'repo' for private repos
   const DEFAULT_OWNER = 'your-github-username';
   const DEFAULT_REPO = 'your-repository-name';
   const DEFAULT_LABELS = ['bug'];
   ```
4. Save the file
5. Go to `chrome://extensions/` and click **Reload** on the extension

### Step 3: Sign In
1. Click the extension icon in Chrome toolbar
2. Click **Sign in with GitHub**
3. Choose scope and authorize
4. ✅ Ready to use!

## 🎯 Usage (30 seconds)

1. **Right-click** on any webpage
2. Select **"Create GitHub Issue from Page/Selection"**
3. Review the captured context
4. Edit title/body if needed
5. Click **Submit Issue**
6. 🎉 Issue created!

## 📚 Need More Help?

- **Detailed guide:** See [INSTALL.md](INSTALL.md)
- **Full documentation:** See [README.md](README.md)
- **Problems?** Check [Troubleshooting](INSTALL.md#troubleshooting)

---

**Total setup time: ~7 minutes** ⏱️
