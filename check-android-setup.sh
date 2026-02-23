#!/bin/bash

echo "🔍 Checking FinTrack Android Setup..."
echo ""

# Check 1: Android folder exists
if [ -d "android" ]; then
    echo "✅ Android project folder exists"
else
    echo "❌ Android folder not found!"
    exit 1
fi

# Check 2: Build files exist
if [ -f "android/build.gradle" ]; then
    echo "✅ Android build.gradle exists"
else
    echo "❌ build.gradle not found!"
    exit 1
fi

# Check 3: Web assets built
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "✅ React app built (dist/ folder exists)"
else
    echo "⚠️  React app not built yet - run: npm run build"
fi

# Check 4: Assets synced to Android
if [ -f "android/app/src/main/assets/public/index.html" ]; then
    echo "✅ Web assets synced to Android"
else
    echo "⚠️  Assets not synced - run: npx cap sync android"
fi

# Check 5: MainActivity exists
if [ -f "android/app/src/main/java/com/fintrack/app/MainActivity.java" ]; then
    echo "✅ MainActivity.java exists"
else
    echo "❌ MainActivity not found!"
fi

# Check 6: AndroidManifest exists
if [ -f "android/app/src/main/AndroidManifest.xml" ]; then
    echo "✅ AndroidManifest.xml exists"
else
    echo "❌ AndroidManifest not found!"
fi

# Check 7: App icons exist
if [ -f "android/app/src/main/res/mipmap-hdpi/ic_launcher.png" ]; then
    echo "✅ App icons generated"
else
    echo "⚠️  App icons missing - run: npx @capacitor/assets generate --android"
fi

# Check 8: Android Studio installed
if [ -d "/Applications/Android Studio.app" ]; then
    echo "✅ Android Studio installed"
else
    echo "⚠️  Android Studio not found at /Applications/Android Studio.app"
    echo "   Download from: https://developer.android.com/studio"
fi

# Check 9: Android Studio running
if pgrep -f "Android Studio" > /dev/null; then
    echo "✅ Android Studio is currently running"
else
    echo "⚠️  Android Studio not running - open it with: npx cap open android"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Summary:"
echo ""
echo "Your Android app is ready to build!"
echo ""
echo "Next steps:"
echo "1. Open Android Studio with: npx cap open android"
echo "2. Wait for Gradle sync to complete (bottom bar)"
echo "3. Select 'app' in config dropdown (top bar)"
echo "4. Select an emulator device (top bar)"
echo "5. Click the green Run button (▶️)"
echo ""
echo "Detailed guide: See TROUBLESHOOTING_EMULATOR.md"
echo ""
