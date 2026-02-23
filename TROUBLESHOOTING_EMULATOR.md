# 🔧 FinTrack - Getting App to Run on Emulator

## Problem: "I can't see my app on the emulator"

This usually means the app hasn't been built/installed yet. Follow these steps **exactly**:

---

## ✅ Step-by-Step Solution

### Step 1: Make Sure You Opened the Correct Folder

**CRITICAL**: You must open the `android` folder, NOT the root `fintrack` folder!

**In Android Studio:**
1. Go to **File → Close Project** (if a project is open)
2. Click **Open**
3. Navigate to: `/Users/creddy/ops/learn/fintrack/android`
   - ⚠️ Make sure you're inside the `android` folder!
4. Click **Open**

**How to verify you opened it correctly:**
- Look at the top-left of Android Studio
- You should see project structure like this:
  ```
  ▼ android
    ▼ app
      ▼ manifests
      ▼ java
      ▼ res
    ▼ Gradle Scripts
  ```
- If you see `fintrack` at the top instead of `android`, you opened the wrong folder!

---

### Step 2: Wait for Gradle Sync (MUST COMPLETE!)

**After opening the project:**

1. Look at the **bottom status bar** of Android Studio
2. You'll see: "Gradle sync in progress..." or "Building..."
3. **WAIT** - this can take 2-10 minutes the first time
4. Watch for: "Gradle sync finished successfully ✓"

**If Gradle sync fails:**
- Click the red text in the bottom panel to see the error
- Common fix: **File → Invalidate Caches → Invalidate and Restart**

---

### Step 3: Check That Run Configuration is Set

**At the top toolbar:**
1. Look for a dropdown that should say **"app"**
2. If it says "No configurations" or is empty:
   - Click the dropdown
   - Select **"app"** from the list
   - If no "app" option, try: **Run → Edit Configurations → + → Android App**

---

### Step 4: Create/Select an Emulator Device

**At the top toolbar (next to the "app" dropdown):**

1. You should see a device dropdown (looks like "No devices" or has a phone icon)
2. Click it

**If you see a device (like "Pixel 6 API 34"):**
- Good! Select it and skip to Step 5

**If no devices exist:**
1. Click **Device Manager** (or the phone icon on the right toolbar)
2. Click **Create Device** (the + button)
3. Select **Phone → Pixel 6** (or any phone you like)
4. Click **Next**
5. Select a **System Image**:
   - Choose "S" (API 31) or higher
   - If you see "Download" next to it, click it and wait for download
6. Click **Next**
7. Give it a name (optional), click **Finish**
8. Close Device Manager

---

### Step 5: Build and Run

**Now the important part:**

1. **Make sure:**
   - ✓ "app" is selected in the config dropdown
   - ✓ Your emulator device is selected
   - ✓ Gradle sync is complete (check bottom bar)

2. **Click the green RUN button (▶️)** or press `Ctrl + R` / `Shift + F10`

3. **Wait and watch the bottom panel:**
   - "Executing tasks..."
   - "BUILD SUCCESSFUL in Xs"
   - "Installing APK..."
   - "Launching app..."

4. **What should happen:**
   - Emulator window opens (may take 1-2 min first time)
   - Blue splash screen appears with "FinTrack" logo
   - Login screen loads

---

## 🎯 Visual Guide: What You Should See

### Top Toolbar Should Look Like:
```
┌────────────────────────────────────────────────────┐
│  [app ▼]   [Pixel 6 API 34 ▼]   [▶ Run]  [■ Stop] │
│   ^^^^         ^^^^^^^^^^^^^        ^^^^            │
│   Config       Device              Click this!      │
└────────────────────────────────────────────────────┘
```

### Bottom Panel During Build:
```
┌────────────────────────────────────────────────────┐
│ Build  │  Logcat  │  Terminal  │  Problems          │
├────────────────────────────────────────────────────┤
│ > Task :app:compileDebugJavaWithJavac              │
│ > Task :app:installDebug                           │
│ BUILD SUCCESSFUL in 24s                            │
│ 58 actionable tasks: 12 executed, 46 up-to-date   │
└────────────────────────────────────────────────────┘
```

---

## 🚨 Common Problems & Solutions

### Problem 1: "Gradle sync failed: Could not resolve dependencies"

**Solution:**
```
1. File → Settings → Appearance & Behavior → System Settings → HTTP Proxy
2. Select "No proxy"
3. Click OK
4. File → Sync Project with Gradle Files
```

### Problem 2: "No configurations available" in dropdown

**Solution:**
```
1. File → Invalidate Caches → Invalidate and Restart
2. Wait for Android Studio to restart
3. File → Sync Project with Gradle Files
```

### Problem 3: "Cannot resolve symbol R" (red errors in code)

**This is normal before Gradle sync completes.** Wait for sync, then:
```
1. Build → Clean Project
2. Build → Rebuild Project
```

### Problem 4: Emulator won't start / very slow

**Solution 1: Check virtualization is enabled**
```
1. Restart Mac
2. Go to System Preferences → Security
3. Allow kernel extensions if prompted
```

**Solution 2: Use a lighter emulator**
```
1. Device Manager → Create Device
2. Choose Pixel 4 (smaller screen, faster)
3. Choose API 31 (not the latest - faster)
```

### Problem 5: "Installation failed: INSTALL_FAILED_INSUFFICIENT_STORAGE"

**Solution:**
```
1. Device Manager → Click edit (pencil icon) on your emulator
2. Show Advanced Settings
3. Increase Internal Storage to at least 2GB
4. Click Finish
```

### Problem 6: Build succeeds but app shows blank white screen

**This means the app is running, but web assets didn't load!**

**Solution:**
```bash
# In terminal:
cd /Users/creddy/ops/learn/fintrack
npm run build
npx cap sync android

# Then in Android Studio, click Run again
```

### Problem 7: "App keeps crashing immediately"

**Check Logcat for errors:**
```
1. Click "Logcat" tab at bottom of Android Studio
2. Filter by "Error" (red icon at top-right of Logcat)
3. Look for red error messages
4. Share the error text with me
```

---

## 🔍 How to Check if App is Actually Installed

**Method 1: Check installed apps in emulator**
1. After clicking Run, wait for "BUILD SUCCESSFUL"
2. In the emulator, swipe up from bottom (or click the dots icon)
3. Look for "FinTrack" app icon
4. If you see it, tap it to open

**Method 2: Check Android Studio Run panel**
```
At bottom of Android Studio:
- Click "Run" tab
- Should show: "Launching 'app' on Pixel 6 API 34"
- Then: "Installed APK..."
- Then: "Launched Activity"
```

**Method 3: Check Logcat**
```
- Click "Logcat" tab at bottom
- Filter dropdown: select "app" or "com.fintrack.app"
- You should see logs from your app
- Look for: "FinTrack" or "Supabase" in the logs
```

---

## 🎬 Expected Timeline

When you click Run (▶️), here's what should happen:

```
0:00 - Click Run button
0:01 - "Executing tasks..." appears
0:10 - "BUILD SUCCESSFUL in 10s"
0:15 - "Installing APK..."
0:20 - Emulator starts launching (if not already running)
1:00 - Emulator is fully booted
1:05 - "Launching 'app'..."
1:10 - Blue splash screen appears!
1:12 - FinTrack login screen loads

Total: ~1-2 minutes first time, 10-20 seconds subsequent runs
```

---

## 📹 Alternative: Video Guide

If you're still stuck, here's what to search on YouTube:
- "How to run Android app in emulator Android Studio"
- "Capacitor Android Studio tutorial"

---

## 🆘 Still Not Working?

If none of the above works, let's debug together. Tell me:

1. **What do you see when you click Run?**
   - Any error messages?
   - Does the build succeed?
   - Does the emulator start?

2. **What's in the bottom panel?**
   - Copy and paste any error text
   - Screenshot if possible

3. **Does the emulator open?**
   - If yes, do you see the Android home screen?
   - Can you swipe up and see other apps?

4. **Logcat errors:**
   - Click Logcat tab
   - Look for red error lines
   - Copy and paste them

---

## ✅ Quick Checklist

Before asking for help, verify:

- [ ] Opened `/Users/creddy/ops/learn/fintrack/android` folder (not root fintrack)
- [ ] Gradle sync completed successfully (check bottom bar)
- [ ] "app" is selected in config dropdown
- [ ] An emulator device is selected
- [ ] Clicked the green Run button (▶️)
- [ ] Waited at least 1-2 minutes
- [ ] Checked Logcat for error messages

---

## 💡 Pro Tips

**Tip 1: Keep emulator running**
- Don't close the emulator between runs
- Next run will be much faster (10-20 seconds)

**Tip 2: Use keyboard shortcuts**
- `Shift + F10` = Run app
- `Shift + F9` = Debug app
- `Cmd + F9` = Build only (don't run)

**Tip 3: Enable instant run**
- Settings → Build, Execution, Deployment → Debugger
- Check "Enable hot swap"
- Changes apply faster

**Tip 4: Monitor build progress**
- Click the "Build" tab at bottom
- Watch real-time build progress
- Helps identify where it's stuck

---

Good luck! You're very close - the app is definitely ready, we just need to get Android Studio to build and install it properly! 🚀
