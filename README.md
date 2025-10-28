# Chrome Issue Reporter

A Chrome extension (Manifest V3) that captures the current page context and helps you file GitHub
issues without leaving the browser. The extension uses the PKCE OAuth flow with
`chrome.identity.launchWebAuthFlow`, stores tokens securely in `chrome.storage.sync`, and submits
issues via the GitHub REST API.

## 🚀 Quick Installation

**Want to install this extension? It's easy!**

1. **Download:** Get the latest `chrome-issue-reporter.zip` from [Releases](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/releases) or [build it yourself](#building-from-source)
2. **Extract:** Unzip to a permanent location on your computer
3. **Install:** Open `chrome://extensions/`, enable Developer mode, click "Load unpacked", and select the extracted folder

📖 **For detailed step-by-step instructions with screenshots, see [INSTALL.md](INSTALL.md)**

## How It Works

1. Right-click on any page and select **"Create GitHub Issue from Page/Selection"**
2. The extension captures:
   - Current URL
   - Selected text (if any)
   - Surrounding HTML context
   - Recent JavaScript errors
   - Nearby script content
3. Review and edit the captured context in the popup
4. Submit directly to GitHub - the issue is created instantly
5. Get a link to your newly created issue

## Project Structure

```
Chrome-Issue-Reporter/
├── extension/              # Extension source files
│   ├── manifest.json      # Extension manifest (V3)
│   ├── background.js      # Service worker, OAuth, GitHub API
│   ├── content.js         # Page context capture
│   ├── pkce.js            # PKCE OAuth implementation
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

1. **Create a GitHub OAuth App:**
   - Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
   - Create a new OAuth App with callback URL: `https://<YOUR_EXTENSION_ID>.chromiumapp.org/`
   - Note your Client ID

2. **Update the extension:**
   - Open `background.js` in your installed extension folder
   - Update `CLIENT_ID`, `REDIRECT_URI`, and default repository settings
   - Reload the extension in `chrome://extensions/`

3. **Sign in:**
   - Click the extension icon and sign in with GitHub
   - Grant the necessary permissions

📖 **See [INSTALL.md](INSTALL.md) for complete configuration instructions**

> **Important:** This extension never ships a client secret. The OAuth flow uses PKCE and the
> browser-managed redirect URL for security.

## Using the extension

1. Open the extension’s **Options** page to set the default repository owner, repository name, and
   any labels that should be applied to every issue. You can also sign in or out from the options
   page.
2. Sign in with GitHub using the PKCE-based OAuth flow. From the extension popup you can choose
   whether to grant access to public repositories only or to include private repositories before
   starting the sign-in. Tokens are stored in `chrome.storage.sync` and can be cleared at any time
   from the options page.
3. When you encounter a problem on a web page, right-click and choose **Create GitHub Issue from
   Page/Selection**. The extension captures the current URL, selected text, surrounding HTML, nearby
   script content, and the most recent JavaScript error (if one was recorded).
4. The browser action popup shows the captured context, lets you edit the issue title and body, and
   submit the issue directly to GitHub. After submission the popup links to the newly created issue.

## Permissions and privacy

- `identity` – required for `chrome.identity.launchWebAuthFlow`.
- `contextMenus` – adds the “Create GitHub Issue from Page/Selection” menu item.
- `activeTab` and `scripting` – used to communicate with the active tab and collect context.
- `storage` – stores OAuth tokens, repository defaults, and captured context.
- Host permission `https://api.github.com/*` – required to create issues via the GitHub API.

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

This creates `chrome-issue-reporter.zip` ready for distribution or installation.

### Available Scripts
- `npm run clean` - Remove build artifacts
- `npm run build` - Build extension to `dist/` folder
- `npm run package` - Build and create ZIP file

### Manual Build
If you don't have Node.js:
```bash
cd extension
zip -r ../chrome-issue-reporter.zip *
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
