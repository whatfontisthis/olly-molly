#!/bin/bash
set -e

echo "========================================"
echo "Olly Molly - Tauri Build Script"
echo "========================================"

# Step 1: Build Next.js standalone
echo ""
echo "Step 1: Building Next.js..."
npm run build

# Step 2: Prepare server files
echo ""
echo "Step 2: Preparing server files..."
rm -rf src-tauri/server
mkdir -p src-tauri/server

# Copy standalone server (including hidden files like .next)
cp -R .next/standalone/. src-tauri/server/
cp -R .next/static src-tauri/server/.next/
cp -R public src-tauri/server/
mkdir -p src-tauri/server/db
cp db/*.sql src-tauri/server/db/

# Remove unnecessary files
rm -rf src-tauri/server/src-tauri 2>/dev/null || true
rm -rf src-tauri/server/scripts 2>/dev/null || true
rm -rf src-tauri/server/components 2>/dev/null || true
rm -rf src-tauri/server/app 2>/dev/null || true
rm -f src-tauri/server/app-icon.png 2>/dev/null || true
rm -f src-tauri/server/*.md 2>/dev/null || true
rm -f src-tauri/server/*.mjs 2>/dev/null || true
rm -f src-tauri/server/*.ts 2>/dev/null || true
rm -f src-tauri/server/package-lock.json 2>/dev/null || true

echo "Server directory size: $(du -sh src-tauri/server | cut -f1)"

# Step 3: Build Tauri app
echo ""
echo "Step 3: Building Tauri app..."
npm run tauri:build || true

# Step 4: Add server to app bundle (use rsync for hidden files)
echo ""
echo "Step 4: Adding server to app bundle..."
APP_PATH="src-tauri/target/release/bundle/macos/Olly Molly.app"
mkdir -p "$APP_PATH/Contents/Resources/server"
# Use rsync to properly copy hidden files like .next
rsync -a src-tauri/server/ "$APP_PATH/Contents/Resources/server/"

# Verify .next was copied
if [ -d "$APP_PATH/Contents/Resources/server/.next" ]; then
    echo "✓ .next directory copied successfully"
else
    echo "✗ ERROR: .next directory not found in app bundle!"
    exit 1
fi

# Step 5: Create DMG
echo ""
echo "Step 5: Creating DMG..."
DMG_PATH="src-tauri/target/release/bundle/olly-molly_0.1.0_aarch64.dmg"
rm -f "$DMG_PATH"
hdiutil create -volname "Olly Molly" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"

echo ""
echo "========================================"
echo "Build complete!"
echo "========================================"
echo ""
echo "App bundle: $APP_PATH"
echo "DMG file:   $DMG_PATH"
echo ""
echo "App size:   $(du -sh "$APP_PATH" | cut -f1)"
echo "DMG size:   $(du -sh "$DMG_PATH" | cut -f1)"
echo ""
echo "NOTE: This app requires Node.js to be installed on the target machine."
echo "      Install via: https://nodejs.org or 'brew install node'"
