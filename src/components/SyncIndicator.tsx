import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Session } from '../lib/schemas'
import utils from '../styles/utils.module.css'

export default function SyncIndicator({ session }: { session: Session | null }) {
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
      <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap1_5} ${utils.textGray400} ${utils.text10px} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider}`}>
        <CloudOff className={utils.iconSm} />
        <span className={`${utils.hidden} ${utils.smInline}`}>Offline</span>
      </div>
    )
  }

  return (
    <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap1_5} ${utils.text10px} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider}`} style={{ color: 'var(--sea-ink-soft)' }}>
      {isSyncing ? (
        <>
          <RefreshCw className={`${utils.iconSm} ${utils.animateSpin}`} style={{ color: '#a18cd1' }} />
          <span className={`${utils.hidden} ${utils.smInline}`}>Syncing...</span>
        </>
      ) : (
        <>
          <Cloud className={utils.iconSm} style={{ color: '#84fab0' }} />
          <span className={`${utils.hidden} ${utils.smInline}`}>Synced</span>
        </>
      )}
    </div>
  )
}
