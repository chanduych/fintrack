#!/bin/bash

# FinTrack Android Build Script
# This script automates the build and sync process

echo "🚀 Building FinTrack Android App..."
echo ""

# Step 1: Build React app
echo "📦 Step 1/3: Building React app..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix errors and try again."
    exit 1
fi

echo "✅ React build complete!"
echo ""

# Step 2: Sync to Android
echo "🔄 Step 2/3: Syncing to Android..."
npx cap sync android

if [ $? -ne 0 ]; then
    echo "❌ Sync failed! Please check Capacitor configuration."
    exit 1
fi

echo "✅ Sync complete!"
echo ""

# Step 3: Open Android Studio
echo "📱 Step 3/3: Opening Android Studio..."
npx cap open android

echo ""
echo "✨ Done! Android Studio should open now."
echo ""
echo "Next steps:"
echo "  1. Wait for Gradle sync to complete in Android Studio"
echo "  2. Click the green Run button to test on emulator/device"
echo "  3. Or go to Build → Build APK to create distributable APK"
echo ""
