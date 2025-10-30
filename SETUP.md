# Easy Setup Guide - Chrome Issue Reporter

Follow these simple steps to get started with Chrome Issue Reporter. Total time: ~5 minutes ⏱️

## Step 1: Install the Extension (1 minute)

1. Visit the [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for **"Chrome Issue Reporter"**
3. Click **"Add to Chrome"**
4. Click **"Add extension"** to confirm

✅ Done! The extension is now installed.

---

## Step 2: Create a GitHub OAuth App (2 minutes)

You need to create a GitHub OAuth App so the extension can access your GitHub account securely.

### 2a. Go to GitHub OAuth Apps page

👉 **Click here:** [https://github.com/settings/developers](https://github.com/settings/developers)

### 2b. Create a new OAuth App

1. Click the **"New OAuth App"** button
2. Fill in the form:
   - **Application name:** `Chrome Issue Reporter` (or any name you prefer)
   - **Homepage URL:** `https://github.com/ralph-cmyk/Chrome-Issue-Reporter`
   - **Authorization callback URL:** `http://localhost` 
     - ⚠️ Important: Use exactly `http://localhost` - GitHub requires this but the extension uses device flow which doesn't need a callback
3. Click **"Register application"**

### 2c. Copy your Client ID

After creating the app, you'll see your **Client ID** on the screen.

1. Look for **"Client ID"** (it starts with `Ov23...`)
2. Click the 📋 copy button next to it
3. Keep this tab open - you'll need it in the next step!

✅ You now have your Client ID!

---

## Step 3: Configure the Extension (1 minute)

### 3a. Open Extension Options

1. Click the **Chrome Issue Reporter** icon in your Chrome toolbar
   - If you don't see it, click the puzzle piece 🧩 icon and find "Chrome Issue Reporter"
2. Right-click the extension icon
3. Click **"Options"**

### 3b. Enter Your Client ID

1. In the options page, find the **"GitHub OAuth App Client ID"** field
2. **Paste** your Client ID from Step 2 (Ctrl+V or Cmd+V)
3. Click **"💾 Save OAuth Configuration"**
4. Wait for the success message ✅

✅ OAuth configured!

---

## Step 4: Sign In to GitHub (1 minute)

### 4a. Start the Sign-In

1. In the same options page, click **"🔐 Sign in with GitHub"**
2. You'll see a verification code (e.g., `ABCD-1234`)
3. A new tab will automatically open to GitHub

### 4b. Authorize the Extension

1. On the GitHub page, you'll see "Device Activation"
2. **Enter the verification code** shown in the extension options page
3. Click **"Continue"**
4. Review the permissions (the extension needs access to create issues)
5. Click **"Authorize"**

### 4c. Return to Options

1. Go back to the Extension Options tab
2. You should see ✅ **"Successfully signed in with GitHub!"**

✅ You're signed in!

---

## Step 5: Select a Repository (1 minute)

### 5a. Load Your Repositories

1. In the options page, click **"📚 Load My Repositories"**
2. Wait a moment while it fetches your repos
3. A dropdown will appear with all your repositories

### 5b. Choose Your Repository

**Option A: Use the dropdown (easier)**
1. Select the repository where you want to create issues
2. Click **"💾 Save Repository Settings"**

**Option B: Enter manually**
1. Fill in:
   - **Repository Owner:** Your username or organization (e.g., `octocat`)
   - **Repository Name:** The repo name (e.g., `my-project`)
2. Click **"💾 Save Repository Settings"**

✅ Repository configured!

---

## 🎉 You're All Set!

Now you can start creating GitHub issues directly from any webpage!

### How to Use:

1. **Right-click** anywhere on a webpage
2. Select **"Create GitHub Issue from Page/Selection"**
3. Review the captured context
4. Edit the title and description
5. Click **"✨ Create Issue"**
6. Done! The issue is created on GitHub 🎊

---

## 📹 Visual Guide

Here's what each step looks like:

### Step 2: Creating OAuth App
```
GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
```

### Step 3: Finding Extension Options
```
Right-click extension icon → Options
```

### Step 4: Sign-In Flow
```
Options → Sign in with GitHub → Copy code → Paste on GitHub → Authorize → Success!
```

### Step 5: Using the Extension
```
Right-click on webpage → Create GitHub Issue → Edit → Submit → Done!
```

---

## ⚠️ Troubleshooting

### "OAuth Client ID not configured" error
- **Solution:** Make sure you saved your Client ID in Step 3b
- Check that you clicked "💾 Save OAuth Configuration"
- The Client ID should start with `Ov23`

### "404 Not Found" error when signing in
- **Solution:** Your Client ID might be wrong
- Go back to GitHub OAuth Apps and copy the Client ID again
- Make sure you copied the full ID (no extra spaces)

### "Authorization pending" timeout
- **Solution:** You took too long to enter the code
- Click "Sign in with GitHub" again to get a new code
- You have 15 minutes to enter the code

### Can't find my repository
- **Solution:** Make sure you're signed in
- Click "Load My Repositories" again
- If still not visible, enter the owner/repo manually

### Issues created in wrong repository
- **Solution:** Check the repository settings
- Make sure you saved the correct owner and repo name

---

## 🔐 Security Notes

- Your GitHub token is stored securely in Chrome's sync storage
- The extension only requests `repo` permission (to create issues)
- No data is sent anywhere except GitHub's official API
- You can revoke access anytime at [github.com/settings/applications](https://github.com/settings/applications)

---

## 📚 More Help

- **Full documentation:** [README.md](README.md)
- **Detailed install guide:** [INSTALL.md](INSTALL.md)
- **Quick reference:** [QUICKSTART.md](QUICKSTART.md)
- **Issues/bugs:** [GitHub Issues](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/issues)

---

**Need more help?** Open an issue on GitHub and we'll assist you! 💪
