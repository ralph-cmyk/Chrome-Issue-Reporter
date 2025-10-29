# Testing Guide

This document explains how to test the Chrome Issue Reporter extension with the new Device Flow authentication.

## Prerequisites

- Chrome browser (or Chromium-based browser like Edge, Brave)
- A GitHub account
- The extension files (from `extension/` directory or `dist/` after build)

## Installation for Testing

1. **Build the extension** (optional if you have the source):
   ```bash
   npm run build
   ```

2. **Load the extension in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extension/` folder (or `dist/` if you built it)

3. **Note the extension ID**:
   - After loading, you'll see the extension ID under the extension name
   - Example: `abcdefghijklmnopqrstuvwxyz123456`

## Testing the Device Flow Authentication

### Test 1: Device Flow Sign-In

1. **Open Options Page**:
   - Right-click the extension icon → "Options"
   - Or go to `chrome://extensions/` and click "Details" → "Extension options"

2. **Start Device Flow**:
   - Click the "🔐 Sign in with GitHub" button
   - You should see a message with:
     - A user code (e.g., `1234-5678`)
     - A URL (`https://github.com/login/device`)
     - Instructions to enter the code

3. **Authorize on GitHub**:
   - A new tab should open to `https://github.com/login/device`
   - Enter the user code shown in the Options page
   - Click "Continue"
   - Review the permissions (should request `repo` access)
   - Click "Authorize"

4. **Verify Success**:
   - The Options page should update to show "✅ Successfully signed in with GitHub!"
   - The "Sign out" button should now be enabled
   - The "Load My Repositories" button should be enabled

### Test 2: Repository Selection

1. **Load Repositories**:
   - Click "📚 Load My Repositories"
   - Wait for the repositories to load
   - You should see "✅ Loaded X repositories"

2. **Select a Repository**:
   - A dropdown should appear with all your repositories
   - Select a repository from the dropdown
   - The "Repository owner" and "Repository name" fields should auto-fill

3. **Save Configuration**:
   - Click "Save Repository Settings"
   - You should see "✅ Repository settings saved"

### Test 3: Creating an Issue

1. **Navigate to any web page**:
   - For example, go to `https://example.com`

2. **Capture Context**:
   - Right-click on the page
   - Select "Create GitHub Issue from Page/Selection"
   - (Optional) Select some text first to include it in the issue

3. **Review and Submit**:
   - Click the extension icon to open the popup
   - You should see:
     - "✅ Authenticated" status
     - "📂 owner/repo" status showing your selected repository
     - A pre-filled issue title and body with captured context
   - Edit the title and body as needed
   - Click "Create issue"

4. **Verify Issue Creation**:
   - You should see "Issue created: #X"
   - Click the issue number link to view it on GitHub
   - Verify the issue was created with the correct content

### Test 4: Sign Out

1. **Sign Out**:
   - Open the Options page
   - Click "Sign out (Clear Token)"
   - You should see "✅ Signed out successfully"
   - The authentication status should change to "⚠️ Not authenticated"

2. **Verify Token Cleared**:
   - Try to create an issue (steps from Test 3)
   - You should see an error: "Authentication required"

### Test 5: Personal Access Token (Alternative Method)

1. **Create a PAT**:
   - Go to https://github.com/settings/tokens/new
   - Create a token with `repo` scope
   - Copy the token

2. **Sign In with PAT**:
   - Open the Options page
   - Paste the token in the "Personal Access Token" field
   - Click "Save & Validate Token"
   - You should see "✅ Token validated and saved successfully!"

3. **Verify**:
   - Follow Test 2 and Test 3 to verify issue creation works

## Expected Behavior

### Authentication Status

- **Before auth**: "⚠️ Not authenticated" (orange)
- **After auth**: "✅ Authenticated" (green)

### Repository Status

- **Before config**: "⚠️ Repository not configured" (orange)
- **After config**: "📂 owner/repo" (green)

### Error Handling

The extension should gracefully handle:
- User canceling the Device Flow
- Network errors
- Rate limiting (GitHub API limits)
- Invalid tokens
- Expired tokens
- Missing repository configuration

## Manual Testing Checklist

- [ ] Device Flow sign-in completes successfully
- [ ] Repository list loads correctly
- [ ] Repository selection auto-fills owner/repo fields
- [ ] Manual owner/repo entry works
- [ ] Issue creation succeeds with captured context
- [ ] Issue link opens correct GitHub issue
- [ ] Sign out clears credentials
- [ ] PAT authentication works as alternative
- [ ] Error messages are clear and helpful
- [ ] UI updates correctly after each action

## Troubleshooting

### Device Flow times out
- GitHub's Device Flow tokens expire after 900 seconds (15 minutes)
- Complete the authorization process within this timeframe
- If it times out, click "Sign in with GitHub" again to get a new code

### Repositories don't load
- Check console for errors (F12 → Console tab)
- Verify token has `repo` scope
- Try signing out and in again

### Issue creation fails
- Verify repository owner/name are correct
- Check you have write access to the repository
- Check GitHub API rate limits

### Extension not loading
- Check for syntax errors in Console
- Verify all files are present
- Try reloading the extension

## Console Logging

For debugging, open the extension's background console:
1. Go to `chrome://extensions/`
2. Find "Chrome Issue Reporter"
3. Click "service worker" link under "Inspect views"
4. Check console for any error messages

## Testing Scenarios

### Scenario 1: First-time User
1. Install extension
2. Open options
3. Click "Sign in with GitHub"
4. Complete Device Flow
5. Load repositories
6. Select a repository
7. Save settings
8. Create an issue

### Scenario 2: Returning User
1. Extension already configured
2. Open any page
3. Right-click → "Create GitHub Issue from Page/Selection"
4. Review captured context
5. Submit issue

### Scenario 3: Token Expiration
1. Wait for token to expire (shouldn't happen with Device Flow tokens)
2. Try to create an issue
3. Should prompt to re-authenticate

## Performance Testing

Note: Times may vary based on network speed, number of repositories, and GitHub API response times.

- Initial load time: < 1 second
- Device Flow initiation: < 2 seconds
- Repository fetch: < 5 seconds (typical for users with < 100 repos)
- Issue creation: < 3 seconds
- Context capture: < 1 second

## Security Testing

Verify:
- Token is stored in `chrome.storage.sync` (encrypted by Chrome)
- No token is logged to console
- No token is sent to third parties
- HTTPS is used for all GitHub API calls
- Device Flow uses proper OAuth flow without client secret
