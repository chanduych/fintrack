import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Running in local mode.')
}

// Use native app behavior only when actually running as native (Android/iOS), not in browser or Capacitor web preview
const isNativeApp = typeof window.Capacitor?.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        // On native app we handle session via deep link; on web Supabase parses hash/query from redirect
        detectSessionInUrl: !isNativeApp,
        flowType: 'pkce',
        storage: isNativeApp ? undefined : window.localStorage,
        storageKey: 'fintrack-auth-token'
      }
    })
  : null

export const hasSupabaseConfig = !!(supabaseUrl && supabaseAnonKey)
