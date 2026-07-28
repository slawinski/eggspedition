import { useState, useEffect } from 'react'
import { CloudOff } from 'lucide-react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import styles from './OfflineBanner.module.css'

/**
 * OfflineBanner — a sticky amber-toned banner shown when the device
 * or browser is offline.
 *
 * Self-contained: reads online status internally via useOnlineStatus.
 * Returns null when SSR, mounted-but-online, or not yet hydrated.
 * Uses `role="status"` because offline is informational, not an error.
 */
export default function OfflineBanner() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { isOnline } = useOnlineStatus()

  // Never render on server or before hydration to avoid SSR mismatch
  if (!mounted || isOnline) return null

  return (
    <div className={styles.banner} role="status">
      <CloudOff className={styles.icon} aria-hidden="true" />
      <span className={styles.compactLabel}>You're offline</span>
      <span className={styles.fullLabel}>
        You&apos;re offline. Changes will sync when connection returns.
      </span>
    </div>
  )
}
