# Release Checklist

Use this checklist when creating a new release of Chrome Issue Reporter.

## Pre-Release

- [ ] Update version in `extension/manifest.json`
- [ ] Update version in `package.json` (if changed)
- [ ] Test the extension locally:
  - [ ] Load unpacked extension works
  - [ ] OAuth flow works
  - [ ] Issue creation works
  - [ ] Context capture works
- [ ] Update CHANGELOG.md (if exists) or document changes in release notes
- [ ] Review and update documentation if needed

## Creating the Release

### Option 1: Using GitHub Actions (Recommended)

1. **Create and push a version tag:**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **GitHub Actions will automatically:**
   - Build the extension
   - Create the ZIP package as `chrome-issue-reporter-extension.zip`
   - Create a GitHub Release
   - Upload the built extension ZIP as a release asset
   
   **Note:** The release will include the built extension package (`chrome-issue-reporter-extension.zip`) plus auto-generated source code archives. Users should download the `-extension.zip` file, NOT the source code archives.

### Option 2: Manual Release

1. **Build the package:**
   ```bash
   npm run package
   # or
   ./build.sh
   ```

2. **Create a GitHub Release:**
   - Go to your repository's releases page: `https://github.com/YOUR_USERNAME/YOUR_REPO/releases/new`
   - Create a new tag (e.g., `v0.1.0`)
   - Fill in release title and notes
   - Upload `chrome-issue-reporter.zip` (you may want to rename it to `chrome-issue-reporter-extension.zip` for clarity)
   - **Important:** Add a note in the release description warning users NOT to download the source code archives
   - Publish release

## Post-Release

- [ ] Verify the release appears on the Releases page
- [ ] Test downloading and installing from the release
- [ ] Announce the release (if applicable)
- [ ] Close any related issues/PRs

## Release Notes Template

```markdown
## Chrome Issue Reporter v0.1.0

### ⚠️ IMPORTANT: Download the Correct File

**✅ Download:** `chrome-issue-reporter-extension.zip` (the built extension package)

**❌ DO NOT download:** Source code (zip) or Source code (tar.gz) - these are the repository files and will NOT work as a Chrome extension!

### What's New
- Feature 1
- Feature 2
- Bug fix 1

### Installation
1. Download `chrome-issue-reporter-extension.zip` from the Assets section below
2. Extract the ZIP file to a permanent location on your computer
3. Open Chrome and navigate to chrome://extensions/
4. Enable Developer mode (toggle in top-right)
5. Click "Load unpacked" and select the extracted folder

See [INSTALL.md](INSTALL.md) for detailed instructions.

### Configuration
This extension uses GitHub Device Flow for authentication - no OAuth app setup required! 
See [QUICKSTART.md](QUICKSTART.md) for the 7-minute setup guide.
```

## Versioning

Follow semantic versioning (semver):
- **Major** (x.0.0): Breaking changes
- **Minor** (0.x.0): New features, backward compatible
- **Patch** (0.0.x): Bug fixes, backward compatible

Example progression: `0.1.0` → `0.1.1` → `0.2.0` → `1.0.0`
