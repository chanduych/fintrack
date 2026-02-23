# Debug OAuth Login - Step by Step

## The Problem
You're seeing a loop: Click "Sign in with Google" → Google login → Redirect back → Back to login page

This means the deep link is working, but the session isn't being set properly.

---

## How to Debug This

### Step 1: Check Logcat for Deep Link Messages

1. In Android Studio, click **Logcat** tab (bottom panel)
2. In the search/filter box, type: `Deep link`
3. Run your app and try to login with Google
4. Look for these messages:

**What you SHOULD see:**
```
Deep link received: com.fintrack.app://#access_token=eyJ...&refresh_token=...
Extracted tokens: {has_access: true, has_refresh: true}
Session set successfully: {...}
```

**What you might see (problems):**
```
Deep link received: https://localhost/#access_token=...
// ^ Wrong! Should be com.fintrack.app://
```

```
Deep link received: com.fintrack.app://
// ^ Missing tokens! Should have access_token and refresh_token
```

```
Extracted tokens: {has_access: true, has_refresh: false}
// ^ Missing refresh token
```

```
Error setting session: Invalid Refresh Token
// ^ Tokens are malformed or expired
```

---

### Step 2: Verify Supabase Configuration

**Go to Supabase Dashboard:**
1. https://app.supabase.com
2. Select your project
3. **Authentication** → **URL Configuration**

**Check these settings:**

#### Redirect URLs (must include):
```
com.fintrack.app://
```

#### Site URL:
```
com.fintrack.app://
```
OR your production web URL

#### Additional Redirect URLs:
If you want both web and mobile to work, add:
```
com.fintrack.app://
http://localhost:5173
http://localhost:3000
```

---

### Step 3: Check OAuth Provider Settings

Still in Supabase Dashboard:

1. **Authentication** → **Providers**
2. Click **Google**
3. Verify:
   - ✅ Enabled
   - ✅ "Skip nonce check" is enabled (important for mobile!)
   - ✅ Authorized redirect URIs in Google Cloud Console includes your Supabase callback URL

---

### Step 4: Test Different Scenarios

#### Scenario A: Test with Email/Password First

This helps isolate if it's an OAuth issue or general auth issue:

1. In the app, click "Don't have an account? Sign up"
2. Enter email and password
3. Click "Sign Up"
4. Does it work?

- **If YES**: OAuth configuration is the problem
- **If NO**: General auth/session issue

#### Scenario B: Test on Web (if you can)

Run the web version:
```bash
npm run dev
```

Open http://localhost:5173 in browser

Try Google sign in:
- **If it works on web but not mobile**: Deep link issue
- **If it fails on both**: Supabase OAuth configuration issue

---

### Step 5: Enable More Logging

Let's add more debug logs. In Android Studio:

1. **Logcat** tab
2. Remove any filters (clear the search box)
3. Filter dropdown: Select **Debug** or **Verbose**
4. Try login again
5. Look for:
   - `Supabase` (any Supabase-related logs)
   - `OAuth` (OAuth flow logs)
   - `Error` (any errors)

---

## Common Issues & Fixes

### Issue 1: "Deep link not received"

**Symptoms:** No "Deep link received" message in Logcat

**Cause:** Intent filter not working in AndroidManifest.xml

**Fix:**
```bash
# Make sure you synced after editing AndroidManifest
npx cap sync android

# In Android Studio:
# Build → Clean Project
# Build → Rebuild Project
```

Verify AndroidManifest.xml has:
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.fintrack.app" />
</intent-filter>
```

---

### Issue 2: "Deep link received but wrong URL"

**Symptoms:** Logcat shows `Deep link received: https://localhost/...`

**Cause:** Old redirect URL still cached or Supabase not updated

**Fix:**
1. Double-check Supabase redirect URLs include `com.fintrack.app://`
2. Clear app data on emulator:
   ```
   Settings → Apps → FinTrack → Storage → Clear Data
   ```
3. Rebuild and reinstall app

---

### Issue 3: "Tokens extracted but session fails"

**Symptoms:** Logcat shows tokens extracted but error setting session

**Possible Causes:**
- Tokens expired during redirect
- Tokens malformed
- PKCE flow mismatch

**Fix:**
1. Try again immediately (tokens expire quickly)
2. Check Supabase → Authentication → Providers → Google → **Enable "Skip nonce check"**
3. Make sure you're using PKCE flow (already configured in our code)

---

### Issue 4: "Session set successfully but still shows login"

**Symptoms:** Logcat shows "Session set successfully" but app shows login page

**Cause:** Auth state not updating in React

**Fix:**

Check if `onAuthStateChange` is firing:

1. Open `src/contexts/AuthContext.jsx`
2. Look at line ~37-54 (the `onAuthStateChange` listener)
3. Add more console logs if needed

**Quick test:**
- After Google login, force quit and reopen app
- If you're logged in after reopening: Session is persisted (good!)
- If you're still logged out: Session persistence issue

---

## Step-by-Step Testing Process

Follow this exact sequence:

### Test 1: Verify Deep Link Works
1. Open your browser on computer
2. Paste: `com.fintrack.app://#access_token=test&refresh_token=test`
3. If emulator is running with app installed, it should open the app
4. Check Logcat for "Deep link received"

✅ **Pass**: Deep link opens app
❌ **Fail**: Check AndroidManifest.xml and rebuild

### Test 2: Verify OAuth Flow
1. In app, click "Sign in with Google"
2. Check Logcat immediately: Look for redirect URL being used
3. Should show: Using redirect URL: `com.fintrack.app://`

✅ **Pass**: Correct redirect URL
❌ **Fail**: Check AuthContext.jsx code

### Test 3: Complete Login
1. Complete Google login in browser
2. Check Logcat for these in sequence:
   - "Deep link received: com.fintrack.app://..."
   - "Extracted tokens: {has_access: true, has_refresh: true}"
   - "Session set successfully"

✅ **Pass**: All three messages appear
❌ **Fail**: Note which message is missing/different

### Test 4: Verify Session Persistence
1. After successful login (if you got there)
2. Force close the app
3. Reopen the app
4. Should stay logged in

✅ **Pass**: Stay logged in
❌ **Fail**: Session not persisting to storage

---

## Emergency Workaround: Use Email/Password

If OAuth continues to be problematic, you can use email/password for now:

### Enable Easy Email Signup (No Verification):

1. Supabase Dashboard → **Authentication** → **Settings**
2. Find "Email Auth" section
3. **Disable** "Enable email confirmations"
4. Save

Now users can:
1. Click "Don't have an account? Sign up"
2. Enter email/password
3. Immediately use the app (no email verification)

---

## What to Share with Me

If it's still not working, share these from Logcat:

1. **All lines containing "Deep link"**
2. **All lines containing "Error"**
3. **All lines containing "Supabase"**
4. **Any red error lines**

Copy and paste them so I can see exactly what's happening.

---

## Next Steps

1. ✅ Rebuild in Android Studio (File → Sync, Build → Rebuild)
2. ✅ Run the app
3. ✅ Open Logcat and filter for "Deep link"
4. ✅ Try Google sign in
5. ✅ Copy the Logcat messages and share them with me

Let's debug this together! 🔍
