import { useState, useEffect } from 'react'

interface OnlineStatus {
  /** Whether the browser reports `navigator.onLine` as `true`. */
  isOnline: boolean
  /** `true` during the first render after transitioning from offline
   *  to online — useful for triggering a sync replay. */
  wasOffline: boolean
}

/**
 * useOnlineStatus — tracks `navigator.onLine` with event listeners
 * and exposes `wasOffline` to indicate a just-completed offline→online
 * transition (resets to `false` on the next render).
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  // Track previous online state so we can signal the transition.
  const [prevOnline, setPrevOnline] = useState(isOnline)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Detect offline→online transition
  useEffect(() => {
    if (!prevOnline && isOnline) {
      setWasOffline(true)
    } else if (wasOffline) {
      // Reset the flag after it's been read (next render)
      setWasOffline(false)
    }
    setPrevOnline(isOnline)
  }, [isOnline, prevOnline, wasOffline])

  return { isOnline, wasOffline }
}
