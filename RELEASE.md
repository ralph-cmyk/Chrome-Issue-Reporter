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
   - Create the ZIP package
   - Create a GitHub Release
   - Upload the ZIP as a release asset

### Option 2: Manual Release

1. **Build the package:**
   ```bash
   npm run package
   # or
   ./build.sh
   ```

2. **Create a GitHub Release:**
   - Go to: https://github.com/ralph-cmyk/Chrome-Issue-Reporter/releases/new
   - Create a new tag (e.g., `v0.1.0`)
   - Fill in release title and notes
   - Upload `chrome-issue-reporter.zip`
   - Publish release

## Post-Release

- [ ] Verify the release appears on the Releases page
- [ ] Test downloading and installing from the release
- [ ] Announce the release (if applicable)
- [ ] Close any related issues/PRs

## Release Notes Template

```markdown
## Chrome Issue Reporter v0.1.0

### What's New
- Feature 1
- Feature 2
- Bug fix 1

### Installation
1. Download `chrome-issue-reporter.zip`
2. Extract to a permanent location
3. Load in Chrome via chrome://extensions/

See [INSTALL.md](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/blob/main/INSTALL.md) for detailed instructions.

### Configuration
This release requires GitHub OAuth setup. See [QUICKSTART.md](https://github.com/ralph-cmyk/Chrome-Issue-Reporter/blob/main/QUICKSTART.md) for the 7-minute setup guide.
```

## Versioning

Follow semantic versioning (semver):
- **Major** (x.0.0): Breaking changes
- **Minor** (0.x.0): New features, backward compatible
- **Patch** (0.0.x): Bug fixes, backward compatible

Example progression: `0.1.0` → `0.1.1` → `0.2.0` → `1.0.0`
