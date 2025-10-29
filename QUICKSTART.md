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
   - **Homepage:** https://github.com/ralph-cmyk/Chrome-Issue-Reporter
   - **Callback URL:** `http://localhost` (required by GitHub)
4. Click **Register application**
5. Copy your **Client ID** (starts with "Ov23...")

### Step 2: Configure Extension
1. Open the extracted extension folder
2. Edit `background.js` in a text editor
3. Find this line (line 15):
   ```javascript
   const GITHUB_CLIENT_ID = 'Ov23liJyiD9bKVNz2X2w';
   ```
4. Replace with your Client ID from Step 1
5. Save the file
6. Go to `chrome://extensions/` and click **Reload** on the extension

### Step 3: Sign In
1. Right-click the extension icon → select **Options**
2. Click **"Sign in with GitHub"**
3. Copy the verification code shown
4. Enter it on the GitHub page that opens
5. Click **Authorize**
6. ✅ Ready to use!

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
