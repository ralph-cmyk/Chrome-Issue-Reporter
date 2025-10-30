# Quick Start Guide

Get started with Chrome Issue Reporter in just a few minutes!

## 📥 Installation (1 minute)

### Install from Chrome Web Store
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for **"Chrome Issue Reporter"**
3. Click **Add to Chrome**
4. Click **Add extension** to confirm
5. ✅ Done! The extension will auto-update automatically.

## ⚙️ Configuration (5 minutes)

### Step 1: Create GitHub OAuth App (2 minutes)
1. Go to: https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in:
   - **Name:** Chrome Issue Reporter
   - **Homepage:** https://github.com/ralph-cmyk/Chrome-Issue-Reporter
   - **Callback URL:** `https://<your-extension-id>.chromiumapp.org/`
     - Get your extension ID from `chrome://extensions/`
4. Click **Register application**
5. Copy your **Client ID** (starts with "Ov23...")

### Step 2: Configure Extension (1 minute)
1. Right-click the extension icon → select **Options**
2. Paste your **Client ID** from Step 1
3. Click **Save**

### Step 3: Sign In (2 minutes)
1. In the **Options** page, click **"Sign in with GitHub"**
2. Copy the verification code shown
3. Enter it on the GitHub page that opens
4. Click **Authorize**
5. ✅ Ready to use!

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

**Total setup time: ~6 minutes** ⏱️
