#!/bin/bash
# Build and package Chrome Issue Reporter extension

set -e  # Exit on error

echo "🔨 Building Chrome Issue Reporter..."
echo ""

# Clean previous builds
echo "1️⃣  Cleaning previous builds..."
rm -rf dist chrome-issue-reporter.zip

# Create dist directory
echo "2️⃣  Creating dist directory..."
mkdir -p dist

# Copy extension files
echo "3️⃣  Copying extension files..."
cp -r extension/* dist/

# Create ZIP package
echo "4️⃣  Creating ZIP package..."
cd dist
zip -r ../chrome-issue-reporter.zip * > /dev/null
cd ..

# Show results
echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Package: chrome-issue-reporter.zip"
echo "📊 Size: $(du -h chrome-issue-reporter.zip | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Extract the ZIP file to a permanent location"
echo "2. Open chrome://extensions/"
echo "3. Enable Developer mode"
echo "4. Click 'Load unpacked' and select the extracted folder"
echo ""
echo "📖 See INSTALL.md for detailed instructions"
