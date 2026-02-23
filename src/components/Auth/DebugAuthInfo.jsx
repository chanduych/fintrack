import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabaseClient'

/**
 * Debug component to show auth state
 * Remove this after OAuth is working
 */
export default function DebugAuthInfo() {
  const [debugInfo, setDebugInfo] = useState({})
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const addLog = (message) => {
      const timestamp = new Date().toLocaleTimeString()
      setLogs(prev => [...prev, `[${timestamp}] ${message}`])
      console.log('[DebugAuthInfo]', message)
    }

    // Check current session
    supabase.auth.getSession().then(({ data, error }) => {
      addLog(`getSession: ${error ? `Error: ${error.message}` : `Session exists: ${!!data.session}`}`)
      setDebugInfo(prev => ({
        ...prev,
        hasSession: !!data.session,
        sessionError: error?.message
      }))
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      addLog(`Auth event: ${event}, User: ${session?.user?.email || 'none'}`)
      setDebugInfo(prev => ({
        ...prev,
        lastEvent: event,
        lastEventTime: new Date().toISOString(),
        userEmail: session?.user?.email,
        hasSession: !!session
      }))
    })

    // Check if running in Capacitor
    setDebugInfo(prev => ({
      ...prev,
      isCapacitor: window.Capacitor !== undefined,
      platform: window.Capacitor?.getPlatform()
    }))

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Don't show in production
  if (import.meta.env.PROD && !window.location.search.includes('debug')) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 overflow-auto bg-gray-900 text-white text-xs p-4 rounded-lg shadow-2xl z-50 font-mono">
      <div className="font-bold mb-2 text-green-400">🔍 Auth Debug Info</div>

      <div className="mb-3 space-y-1">
        <div>Platform: {debugInfo.isCapacitor ? `Capacitor (${debugInfo.platform})` : 'Web'}</div>
        <div>Has Session: {debugInfo.hasSession ? '✅ Yes' : '❌ No'}</div>
        {debugInfo.userEmail && <div>User: {debugInfo.userEmail}</div>}
        {debugInfo.lastEvent && (
          <div>Last Event: {debugInfo.lastEvent} ({new Date(debugInfo.lastEventTime).toLocaleTimeString()})</div>
        )}
        {debugInfo.sessionError && (
          <div className="text-red-400">Error: {debugInfo.sessionError}</div>
        )}
      </div>

      <div className="border-t border-gray-700 pt-2 mt-2">
        <div className="font-bold mb-1 text-yellow-400">Event Log:</div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">No events yet...</div>
          ) : (
            logs.slice(-10).map((log, i) => (
              <div key={i} className="text-gray-300">{log}</div>
            ))
          )}
        </div>
      </div>

      <button
        onClick={() => {
          console.log('=== FULL DEBUG INFO ===')
          console.log('Debug Info:', debugInfo)
          console.log('All Logs:', logs)
          console.log('Window.Capacitor:', window.Capacitor)
          alert('Check browser/Logcat console for full debug info')
        }}
        className="mt-2 w-full py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs"
      >
        Log Full Debug Info
      </button>
    </div>
  )
}
