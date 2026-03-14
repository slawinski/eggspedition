import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'

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
      <div className="flex items-center gap-1 text-gray-400 text-xs">
        <CloudOff className="h-4 w-4" />
        <span className="hidden sm:inline">Offline</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-[var(--sea-ink-soft)] text-xs">
      {isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin text-[#a18cd1]" />
          <span className="hidden sm:inline">Syncing...</span>
        </>
      ) : (
        <>
          <Cloud className="h-4 w-4 text-[#84fab0]" />
          <span className="hidden sm:inline">Synced</span>
        </>
      )}
    </div>
  )
}
