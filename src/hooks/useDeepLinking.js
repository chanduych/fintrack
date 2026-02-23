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

      // Handle Supabase OAuth redirect
      if (url.includes('#access_token') || url.includes('access_token=')) {
        try {
          // Extract hash or query params
          let params
          if (url.includes('#')) {
            const hash = url.split('#')[1]
            params = new URLSearchParams(hash)
          } else if (url.includes('?')) {
            const query = url.split('?')[1]
            params = new URLSearchParams(query)
          }

          if (params) {
            const access_token = params.get('access_token')
            const refresh_token = params.get('refresh_token')

            console.log('Extracted tokens:', {
              has_access: !!access_token,
              has_refresh: !!refresh_token
            })

            if (access_token && refresh_token) {
              // Set the session with proper token format
              const { data, error } = await supabase.auth.setSession({
                access_token,
                refresh_token
              })

              if (error) {
                console.error('Error setting session:', error)
              } else {
                console.log('Session set successfully:', data)
              }
            } else {
              console.error('Missing tokens in deep link')
            }
          }
        } catch (error) {
          console.error('Error handling deep link:', error)
        }
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
