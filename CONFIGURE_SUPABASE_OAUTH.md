# Configure Supabase for Mobile OAuth

## Problem
When you log in with Google on the Android app, Supabase tries to redirect to `https://localhost/` which doesn't work on mobile devices.

## Solution
We've configured the app to use a custom URL scheme (`com.fintrack.app://`) for OAuth redirects on the native app only. On desktop/localhost the app uses `window.location.origin`. You must add all of these to Supabase's **Redirect URLs** allow list.

---

## Login broken on Android and/or Desktop?

If Google sign-in fails on **both** localhost and the Android app, work through this checklist:

### 1. Supabase → Authentication → URL Configuration

- **Redirect URLs** (allow list): add every URL your app can redirect to. The `redirectTo` value in code must **exactly** match one of these (or match a wildcard).
  - For **desktop/localhost**: add the exact origin you use in the browser, e.g.:
    - `http://localhost:5173` (Vite default)
    - `http://localhost:5173/**` (covers paths; recommended)
    - If you use a different port, add it too (e.g. `http://localhost:3000/**`)
    - Optional: `http://127.0.0.1:5173/**` if you open the app via IP
  - For **Android app**: add:
    - `com.fintrack.app://`
  - For **production web**: add your production origin, e.g. `https://your-app.vercel.app/**`
- **Site URL**: set this to your **primary web URL** (e.g. `http://localhost:5173` for local dev or `https://your-app.vercel.app` for production). Do **not** set it to `com.fintrack.app://` if you use the app in the browser; that can break desktop login and email confirmation links.

### 2. Google Cloud Console (Google OAuth)

- **Web client**: In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials, your **Web application** OAuth 2.0 Client ID must have **Authorized redirect URIs** including Supabase’s callback:
  - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
  - Replace `<YOUR-PROJECT-REF>` with your Supabase project ref (from Supabase Dashboard URL or project settings).
- **Android client**: Create an **Android** OAuth 2.0 Client ID with your app’s package name and SHA-1 (debug and release if needed). No redirect URI needed for Android type.

### 3. Supabase → Authentication → Providers → Google

- Enable Google provider.
- Use the **Web client** Client ID and Client Secret from Google (the one that has the Supabase callback redirect URI).

### 4. After changing Supabase URLs

- Click **Save** in URL Configuration.
- On **desktop**: hard refresh or clear site data for localhost and try again.
- On **Android**: rebuild and reinstall: `npm run build && npx cap sync android`, then run from Android Studio.

---

## Android: Google login not working (but web works)

On Android, the system **strips the URL fragment** (the part after `#`) when opening your app via a custom scheme. Supabase sends tokens in the fragment (`com.fintrack.app://#access_token=...`), so the app often receives no tokens and login fails.

**Fix: use the auth callback page (recommended)**

1. **Deploy the callback page**  
   The repo includes `public/auth-callback.html`. When you deploy your web app (e.g. to Vercel), this file is served at:
   - `https://your-app.vercel.app/auth-callback.html`

2. **Add that URL in Supabase**  
   In **Authentication → URL Configuration → Redirect URLs**, add:
   - `https://your-app.vercel.app/auth-callback.html`  
   (Use your real deployed URL.)

3. **Point the Android app at it**  
   When building the Android app, set this env var so the app uses the callback page for Google sign-in:
   - Create or edit `.env` in the project root and add:
     ```bash
     VITE_AUTH_CALLBACK_URL=https://your-app.vercel.app/auth-callback.html
     ```
   - Replace with your actual deployed URL (no trailing slash).

4. **Rebuild Android**  
   ```bash
   npm run build
   npx cap sync android
   ```
   Then run the app from Android Studio.

**Flow:** User taps “Sign in with Google” → browser opens → after Google login, Supabase redirects to your **HTTPS** callback page with tokens in the hash → that page redirects to `com.fintrack.app://auth?access_token=...&refresh_token=...` (query params) → Android passes query params to the app → the app sets the session and the user is logged in.

If you don’t set `VITE_AUTH_CALLBACK_URL`, the app falls back to `com.fintrack.app://auth`; that only works if your device/OS passes the fragment (many don’t).

---

## Step 1: Add Redirect URLs in Supabase

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. Navigate to your FinTrack project
3. Go to **Authentication** (left sidebar)
4. Click **URL Configuration**
5. In the **Redirect URLs** section, add:

   ```
   com.fintrack.app://
   com.fintrack.app://auth
   http://localhost:5173
   http://localhost:5173/**
   http://localhost:3000
   http://localhost:3000/**
   https://your-deployed-url.vercel.app
   https://your-deployed-url.vercel.app/**
   https://your-deployed-url.vercel.app/auth-callback.html
   ```

   **Explanation:**
   - `com.fintrack.app://` and `com.fintrack.app://auth` – Android app deep link (use auth callback page + `VITE_AUTH_CALLBACK_URL` for reliable token delivery)
   - `http://localhost:5173` and `http://localhost:5173/**` – local dev (Vite)
   - Same for port 3000 if you use it
   - `https://.../auth-callback.html` – required for Android when using the callback page (see “Android: Google login not working” above)
   - Add your production origin when you deploy

6. Click **Save**

---

## Step 2: Set Site URL

In **URL Configuration**:

1. Set **Site URL** to your main **web** URL, e.g.:
   - Local: `http://localhost:5173`
   - Production: `https://your-deployed-url.vercel.app`
2. Avoid using `com.fintrack.app://` as Site URL so that desktop and email links keep working

---

## Step 3: Rebuild and Test

Now that Supabase is configured, rebuild your app:

```bash
npm run build
npx cap sync android
npx cap open android
```

In Android Studio, click **Run** (▶️)

---

## How It Works Now

### Web App (Browser):
```
User clicks "Sign in with Google"
  ↓
Redirects to Google login
  ↓
Google authenticates
  ↓
Redirects back to: http://localhost:5173 (or your Vercel URL)
  ↓
Supabase extracts tokens from URL
  ↓
User is logged in ✅
```

### Mobile App (Android):
```
User clicks "Sign in with Google"
  ↓
Opens browser/Google login
  ↓
Google authenticates
  ↓
Redirects to: com.fintrack.app://
  ↓
Android intercepts the deep link (AndroidManifest.xml)
  ↓
App opens and receives the deep link
  ↓
useDeepLinking hook extracts tokens
  ↓
Supabase session is set
  ↓
User is logged in ✅
```

---

## Testing OAuth Login

### Test on Emulator:

1. Launch the app on emulator
2. Click **"Sign in with Google"**
3. Google login page should open in browser
4. Sign in with your Google account
5. Browser should redirect and app should open
6. You should be logged in!

### If It Doesn't Work:

**Check Logcat in Android Studio:**
1. Click **Logcat** tab at bottom
2. Look for "Deep link received:" message
3. Look for any error messages

**Common Issues:**

**Issue 1: "Invalid redirect URL"**
- **Cause**: Supabase doesn't have `com.fintrack.app://` in allowed redirect URLs
- **Fix**: Add it in Supabase Dashboard → Authentication → URL Configuration

**Issue 2: Browser opens but doesn't redirect back to app**
- **Cause**: Deep link intent filter not working
- **Fix**: Make sure you rebuilt after editing AndroidManifest.xml
  ```bash
  npm run build
  npx cap sync android
  # Then rebuild in Android Studio
  ```

**Issue 3: App crashes after redirect**
- **Cause**: Error in deep link handling code
- **Fix**: Check Logcat for JavaScript errors

**Issue 4: "localhost" still appears in URL**
- **Cause**: Using old build without the fix
- **Fix**: Clear Android Studio build cache
  ```
  In Android Studio:
  Build → Clean Project
  Build → Rebuild Project
  ```

---

## Code Changes Made

Here's what was changed to make this work:

### 1. Updated `src/services/supabaseClient.js`
```javascript
// Only treat as native app when actually running on device (not in browser/Capacitor web preview)
const isNativeApp = typeof window.Capacitor?.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()

auth: {
  detectSessionInUrl: !isNativeApp,
  flowType: 'pkce',
  storage: isNativeApp ? undefined : window.localStorage,
  storageKey: 'fintrack-auth-token'
}
```

### 2. Updated `src/contexts/AuthContext.jsx`
```javascript
// Use app scheme only when running as native app; desktop always uses window.location.origin
const signInWithGoogle = async () => {
  const isNativeApp = typeof window.Capacitor?.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()
  const redirectUrl = isNativeApp ? 'com.fintrack.app://' : window.location.origin

  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl }
  })
}
```

### 3. Updated `android/app/src/main/AndroidManifest.xml`
```xml
<!-- Added deep link intent filter -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.fintrack.app" />
</intent-filter>
```

### 4. Created `src/hooks/useDeepLinking.js`
```javascript
// Listens for deep link opens and handles OAuth callbacks
import { App as CapApp } from '@capacitor/app'

export function useDeepLinking() {
  // Listen for com.fintrack.app:// deep links
  // Extract OAuth tokens and set Supabase session
}
```

### 5. Updated `src/App.jsx`
```javascript
// Added deep linking hook
import { useDeepLinking } from './hooks/useDeepLinking'

function App() {
  useDeepLinking() // Handle OAuth redirects
  // ...
}
```

---

## Alternative: Email/Password Login

If OAuth is giving you trouble, email/password login still works without any special configuration:

1. Click "Don't have an account? Sign up"
2. Enter email and password
3. Click "Sign Up"
4. Check email for verification link (this will also need redirect URL configuration if clicked on mobile)

For testing, you can temporarily disable email verification:
1. Supabase Dashboard → Authentication → Settings
2. Scroll to "Email Auth"
3. Uncheck "Enable email confirmations"
4. Now signups work immediately without email verification

---

## Summary

✅ **What's Fixed:**
- Mobile app now uses `com.fintrack.app://` for OAuth redirects
- Deep link handler catches the redirect and logs user in
- Android manifest configured to intercept the custom URL scheme
- Web app still uses normal `http://localhost` or `https://` URLs

⚠️ **What You Need to Do:**
1. Add `com.fintrack.app://` to Supabase redirect URLs
2. Rebuild and test: `npm run build && npx cap sync android`

🎯 **Expected Result:**
- Google sign-in works on both web and mobile
- User stays in the app after authentication
- No more "localhost" redirect errors

---

Good luck! Let me know if you see any errors in Logcat when testing.
