import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'
import styles from './SyncIndicator.module.css'

export default function SyncIndicator() {
  const isFetching = useIsFetching()
  const isMutating = useIsMutating()
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const isSyncing = isFetching > 0 || isMutating > 0

  if (!isOnline) {
    return (
      <div className={`${styles.container} ${styles.offline}`}>
        <CloudOff className={styles.icon} />
        <span className={styles.label}>Offline</span>
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${isSyncing ? styles.syncing : styles.synced}`}>
      {isSyncing ? (
        <>
          <RefreshCw className={`${styles.icon} ${styles.spin}`} style={{ color: '#a18cd1' }} />
          <span className={styles.label}>Syncing...</span>
        </>
      ) : (
        <>
          <Cloud className={styles.icon} style={{ color: '#84fab0' }} />
          <span className={styles.label}>Synced</span>
        </>
      )}
    </div>
  )
}
