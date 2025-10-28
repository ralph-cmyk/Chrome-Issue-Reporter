# Chrome Issue Reporter

A Chrome extension (Manifest V3) that captures the current page context and helps you file GitHub
issues without leaving the browser. The extension uses the PKCE OAuth flow with
`chrome.identity.launchWebAuthFlow`, stores tokens securely in `chrome.storage.sync`, and submits
issues via the GitHub REST API.

## Project structure

```
extension/
  manifest.json
  background.js
  content.js
  options.html
  options.js
  pkce.js
  ui/
    popup.html
    popup.js
```

## Prerequisites

1. Create a GitHub OAuth App (or configure an existing one) and note the **Client ID**.
2. Decide which repository should receive issues and which default labels you want to apply.

> **Important:** This project never ships a client secret. The OAuth flow uses PKCE and the
> browser-managed redirect URL.

## Configure the extension

1. Open `extension/background.js` and update the placeholder constants:
   - `CLIENT_ID` – your GitHub OAuth App client ID.
   - `REDIRECT_URI` – `https://<EXTENSION_ID>.chromiumapp.org/`.
   - `GITHUB_SCOPES` – either `public_repo` or `repo` depending on whether the target repository is
     public or private.
   - `DEFAULT_OWNER`, `DEFAULT_REPO`, and `DEFAULT_LABELS` – repository defaults used when creating
     issues.
2. Load the unpacked extension in Chrome:
   - Navigate to `chrome://extensions`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the `extension` directory from this project.
3. After the first load, Chrome assigns an extension ID. Update the `REDIRECT_URI` constant so that
   the hostname matches the assigned ID (e.g. `https://abcdefghijklmnop.chromiumapp.org/`).
4. Optionally adjust UI strings or defaults in `extension/options.html` and `extension/ui/popup.html`.

## Using the extension

1. Open the extension’s **Options** page to set the default repository owner, repository name, and
   any labels that should be applied to every issue. You can also sign in or out from the options
   page.
2. Sign in with GitHub using the PKCE-based OAuth flow. Tokens are stored in `chrome.storage.sync`
   and can be cleared at any time from the options page.
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

## Packaging the extension

1. Update any placeholder constants and verify that the popup/options flows work as expected.
2. From `chrome://extensions`, choose **Pack extension** and point Chrome at the `extension`
   directory.
3. Distribute the generated `.crx` and `.pem` files according to your deployment needs.

## Troubleshooting

- **Rate limits:** If GitHub responds with a 403 and `X-RateLimit-Remaining: 0`, the extension will
  surface a rate-limit message. Wait until the limit resets or adjust your usage.
- **Expired tokens:** A 401 response clears the stored token and prompts you to sign in again.
- **Context capture issues:** Use the context menu again to refresh the captured data or click
  **Clear** in the popup before retrying.
