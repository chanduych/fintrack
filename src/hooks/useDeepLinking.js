import { useEffect } from 'react'
import { App as CapApp } from '@capacitor/app'
import { supabase } from '../services/supabaseClient'

/**
 * Hook to handle deep link OAuth redirects on mobile
 */
export function useDeepLinking() {
  useEffect(() => {
    // Only set up listener if running in Capacitor (mobile)
    if (window.Capacitor === undefined) {
      return
    }

    const handleAppUrlOpen = async (event) => {
      const url = event.url

      console.log('Deep link received:', url)

      // Handle Supabase OAuth redirect: PKCE sends ?code=..., implicit sends access_token (hash or query)
      const hasAuthData = url.includes('code=') || url.includes('#access_token') || url.includes('access_token=')
      if (!hasAuthData) return

      try {
        const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : ''
        const hashPart = url.includes('#') ? url.split('#')[1] : ''
        const params = new URLSearchParams(queryPart || hashPart)

        const code = params.get('code')
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('Error exchanging code for session:', error)
          } else {
            console.log('Session set successfully (PKCE)', data)
          }
          return
        }

        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token
          })
          if (error) {
            console.error('Error setting session:', error)
          } else {
            console.log('Session set successfully', data)
          }
        } else {
          console.error('Missing tokens in deep link')
        }
      } catch (err) {
        console.error('Error handling deep link:', err)
      }
    }

    // Listen for app URL opens (deep links)
    const listener = CapApp.addListener('appUrlOpen', handleAppUrlOpen)

    // Also check if app was opened with a URL on initial launch
    CapApp.getLaunchUrl().then((launchUrl) => {
      if (launchUrl?.url) {
        console.log('App launched with URL:', launchUrl.url)
        handleAppUrlOpen({ url: launchUrl.url })
      }
    })

    return () => {
      listener.then(l => l.remove())
    }
  }, [])
}
