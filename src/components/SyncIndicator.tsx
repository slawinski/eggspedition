import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Session } from '../lib/schemas'

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
      <div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
        <CloudOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Offline</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-[var(--sea-ink-soft)] text-[10px] font-bold uppercase tracking-wider">
      {isSyncing ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#a18cd1]" />
          <span className="hidden sm:inline">Syncing...</span>
        </>
      ) : (
        <>
          <Cloud className="h-3.5 w-3.5 text-[#84fab0]" />
          <span className="hidden sm:inline">Synced</span>
        </>
      )}
    </div>
  )
}
