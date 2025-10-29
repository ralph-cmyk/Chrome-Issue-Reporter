# Release Checklist

Use this checklist when creating a new release of Chrome Issue Reporter.

## Pre-Release

- [ ] Update version in `extension/manifest.json` (if needed)
- [ ] Update version in `package.json` (if changed)
- [ ] Test the extension locally:
  - [ ] Load unpacked extension works
  - [ ] OAuth flow works
  - [ ] Issue creation works
  - [ ] Context capture works
- [ ] Update CHANGELOG.md (if exists) or document changes in release notes
- [ ] Review and update documentation if needed

## Creating the Release

### Automatic Release (Default)

**Every merge or push to the `main` branch automatically creates a new release!**

The GitHub Actions workflow automatically:
1. Determines the next version number (increments from the latest `vN` tag)
2. Builds the extension package
3. Creates a new version tag (e.g., `v10`, `v11`, etc.)
4. Creates a GitHub Release marked as "latest"
5. Uploads the built extension ZIP as a release asset

**No manual steps required!** Just merge your PR to main and the release will be created automatically.

### Manual Release (Optional)

If you need to create a release manually with a specific version tag:

1. **Go to Actions tab** in GitHub
2. **Select "Build and Release (Manual)" workflow**
3. **Click "Run workflow"**
4. **Enter the tag name** (e.g., `v10`)
5. **Click "Run workflow"** button

The workflow will build, tag, and create the release for you.

## Post-Release

- [ ] Verify the release appears on the Releases page
- [ ] Test downloading and installing from the release
- [ ] Announce the release (if applicable)
- [ ] Close any related issues/PRs

## Release Notes Template

The automated workflow uses this template:

```markdown
## Chrome Issue Reporter vN

### ⚠️ IMPORTANT: Download the Correct File

**✅ Download:** `chrome-issue-reporter-extension.zip` (the built extension package)

**❌ DO NOT download:** Source code (zip) or Source code (tar.gz) - these contain the repository structure and will NOT work with Chrome!

### Installation Instructions

1. **Download** `chrome-issue-reporter-extension.zip` from the Assets section below
2. **Extract** the ZIP file to a permanent location on your computer
3. **Open Chrome** and navigate to `chrome://extensions/`
4. **Enable** Developer mode (toggle in the top-right corner)
5. **Click** "Load unpacked" and select the extracted folder

📖 For detailed step-by-step instructions, see [INSTALL.md](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/blob/main/INSTALL.md)

### What's Included

This package contains:
- Complete Chrome extension files (Manifest V3)
- All required JavaScript, HTML, and JSON files
- Ready to load directly into Chrome

### Configuration Required

After installation, configure the extension:
1. Open the extension's **Options** page
2. Sign in with GitHub using Device Flow (no OAuth app needed!)
3. Select your target repository
4. Start creating issues!

📖 See [QUICKSTART.md](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/blob/main/QUICKSTART.md) for a 7-minute setup guide
```

## Versioning

The automated workflow uses incremental numeric versioning:
- Each merge to `main` creates a new version: `v1`, `v2`, `v3`, etc.
- The version is determined by finding the highest numeric `vN` tag and incrementing it
- If no version tags exist, it starts at `v1`

This ensures every merge to main has a unique, trackable version.
