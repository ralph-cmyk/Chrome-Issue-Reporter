# Chrome Issue Reporter

A Chrome extension (Manifest V3) that captures the current page context and helps you file GitHub
issues without leaving the browser. The extension uses GitHub OAuth for authentication,
stores tokens securely in `chrome.storage.sync`, and submits issues via the GitHub REST API.

## 🚀 Quick Installation

**Want to install this extension? It's easy!**

1. **Download:** Get the latest `chrome-issue-reporter-extension.zip` from [Releases](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/releases) or [build it yourself](#building-from-source)
   - ⚠️ **Important:** Download the `-extension.zip` file, NOT the "Source code" archives!
2. **Extract:** Unzip to a permanent location on your computer
3. **Install:** Open `chrome://extensions/`, enable Developer mode, click "Load unpacked", and select the extracted folder
4. **Configure:** Create a GitHub OAuth App and configure the extension with your Client ID

📖 **For detailed step-by-step instructions, see [INSTALL.md](INSTALL.md)**  
⚡ **For a quick 7-minute setup guide, see [QUICKSTART.md](QUICKSTART.md)**

## ✨ Features

- **🎯 Live Select Mode**: Interactively select problematic elements with visual highlighting
- **📝 Clean Feedback Interface**: Separate user feedback from technical details
- **📊 Console Log Capture**: Automatically captures console messages for debugging
- **🔍 Smart Context Detection**: Captures HTML, CSS selectors, and JavaScript context
- **🔒 Secure OAuth**: GitHub OAuth device flow for safe authentication
- **⚡ Direct Integration**: Create issues without leaving your browser
- **🎨 Beautiful UI**: Modern, gradient-based design with smooth animations
- **📦 Manifest V3**: Built with the latest Chrome extension standards

## How It Works

### Method 1: Live Select (NEW! 🎯)

1. Open the extension popup by clicking the extension icon
2. Click **"🎯 Live Select Element"** button
3. The page is frozen with an interactive overlay
4. Hover over elements to see them highlighted
5. Click on any element to select it
6. The popup reopens with pre-filled technical details
7. Add your feedback about what's wrong in the clean text area
8. Click **"✨ Create Issue"** to submit to GitHub

### Method 2: Context Menu

1. Right-click on any page and select **"Create GitHub Issue from Page/Selection"**
2. The extension captures context from the current selection or page
3. Review and edit in the popup
4. Submit directly to GitHub

### What Gets Captured

The extension automatically captures:
- **Element Details**: Tag name, ID, classes, and CSS selector (with Live Select)
- **Current URL**: The page where the issue was found
- **Selected Text**: Any text you had highlighted
- **HTML Context**: The surrounding HTML structure
- **Console Logs**: Recent console messages (log, error, warn) - last 20 entries
- **JavaScript Errors**: Any errors that occurred on the page
- **Script Content**: Nearby JavaScript code
- **User Agent**: Browser and OS information

All technical details are stored in a hidden section, keeping your feedback area clean!

## Project Structure

```
Chrome-Issue-Reporter/
├── extension/              # Extension source files
│   ├── manifest.json      # Extension manifest (V3)
│   ├── background.js      # Service worker, OAuth auth, GitHub API
│   ├── content.js         # Page context capture
│   ├── options.html       # Extension options page
│   ├── options.js         # Options page logic
│   └── ui/
│       ├── popup.html     # Extension popup UI
│       └── popup.js       # Popup logic and issue submission
├── .github/
│   └── workflows/
│       └── release.yml    # Automated release workflow
├── INSTALL.md             # Detailed installation guide
├── README.md              # This file
└── package.json           # Build scripts and metadata
```

## Configuration

After installation, you need to configure the extension:

1. **Create a GitHub OAuth App (REQUIRED):**
   - This extension uses GitHub OAuth for authentication
   - You MUST create an OAuth App
   - See [INSTALL.md](INSTALL.md) for step-by-step instructions

2. **Sign in with GitHub:**
   - Open the extension's **Options** page
   - Click **"Sign in with GitHub"** to start the OAuth flow
   - You'll receive a code to enter on GitHub.com
   - After authorization, you're ready to go!

3. **Select a Repository:**
   - After signing in, click **"Load My Repositories"**
   - Choose the repository where you want to create issues from the dropdown
   - Or manually enter the repository owner and name

4. **Start Using:**
   - Right-click on any page and select **"Create GitHub Issue from Page/Selection"**
   - Review and submit your issue!

📖 **See [INSTALL.md](INSTALL.md) for detailed setup instructions**

## Using the extension

1. **Sign in with GitHub:** Open the extension's **Options** page and click **"Sign in with GitHub"**. 
   You'll get a code to enter on GitHub.com to authorize the extension.
2. **Select a repository:** After signing in, click **"Load My Repositories"** to see all repositories 
   you have access to. Choose one from the dropdown or manually enter the owner/repo. You can also set 
   default labels to apply to all issues.
3. When you encounter a problem on a web page, right-click and choose **Create GitHub Issue from
   Page/Selection**. The extension captures the current URL, selected text, surrounding HTML, nearby
   script content, and the most recent JavaScript error (if one was recorded).
4. The browser action popup shows the captured context, lets you edit the issue title and body, and
   submit the issue directly to GitHub. After submission the popup links to the newly created issue.


## Permissions and privacy

- `contextMenus` – adds the “Create GitHub Issue from Page/Selection” menu item.
- `activeTab` and `scripting` – used to communicate with the active tab and collect context.
- `storage` – stores OAuth tokens, repository defaults, and captured context.
- Host permission `https://api.github.com/*` – required to create issues via the GitHub API.
- Host permission `https://github.com/login/*` – required for OAuth authentication.

Captured page context (URL, selection, snippets, and last error message) is stored locally until you
submit or clear it. OAuth tokens are only stored inside Chrome’s managed storage. No data is sent to
third-party services other than GitHub APIs during authentication and issue creation.

## Building from Source

Want to build the extension yourself or contribute? Here's how:

### Quick Build
```bash
# Clone the repository
git clone https://github.com/ralph-cmyk/Chrome-Issue-Reporter.git
cd Chrome-Issue-Reporter

# Build and package
npm run package
```

This creates `chrome-issue-reporter-extension.zip` ready for distribution or installation.

### Available Scripts
- `npm run clean` - Remove build artifacts
- `npm run build` - Build extension to `dist/` folder
- `npm run package` - Build and create ZIP file

### Manual Build
If you don't have Node.js:
```bash
cd extension
zip -r ../chrome-issue-reporter-extension.zip *
```

## For Developers

### Development Installation
1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable Developer mode
4. Click "Load unpacked" and select the `extension/` directory

### Testing Changes
After making changes:
1. Save your files
2. Click the Reload button for the extension in `chrome://extensions/`
3. Test your changes

## Troubleshooting

- **Rate limits:** If GitHub responds with a 403 and `X-RateLimit-Remaining: 0`, the extension will
  surface a rate-limit message. Wait until the limit resets or adjust your usage.
- **Expired tokens:** A 401 response clears the stored token and prompts you to sign in again.
- **Context capture issues:** Use the context menu again to refresh the captured data or click
  **Clear** in the popup before retrying.
