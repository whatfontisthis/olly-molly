#!/bin/bash

# Build Next.js standalone
echo "Building Next.js..."
npm run build

# Create server directory for Tauri resources
echo "Preparing server files..."
rm -rf src-tauri/server
mkdir -p src-tauri/server

# Copy standalone server (minimal files only)
cp -r .next/standalone/. src-tauri/server/
cp -r .next/static src-tauri/server/.next/
cp -r public src-tauri/server/
mkdir -p src-tauri/server/db
cp db/*.sql src-tauri/server/db/

# Remove unnecessary files from server bundle
rm -rf src-tauri/server/src-tauri
rm -rf src-tauri/server/scripts
rm -rf src-tauri/server/components
rm -rf src-tauri/server/app
rm -f src-tauri/server/app-icon.png
rm -f src-tauri/server/*.md
rm -f src-tauri/server/*.mjs
rm -f src-tauri/server/*.ts
rm -f src-tauri/server/package-lock.json

# Copy node binary for running the server
NODE_PATH=$(which node)
cp "$NODE_PATH" src-tauri/server/

echo "Server files prepared!"
echo ""
echo "Server directory size:"
du -sh src-tauri/server
echo ""
echo "Now run: npm run tauri:build"
