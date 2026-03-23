import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { Cloud, CloudOff, RefreshCw, User, Home } from 'lucide-react'
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
      <div className="flex items-center gap-1 text-gray-400 text-xs font-bold uppercase tracking-tight">
        <CloudOff className="h-4 w-4" />
        <span className="hidden sm:inline">Offline</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      {session && (
        <div className="hidden lg:flex items-center gap-3 border-r border-[var(--line)] pr-4">
          <div className="flex items-center gap-1.5 text-[var(--sea-ink-soft)] text-xs font-bold uppercase tracking-tight">
            <User className="h-3.5 w-3.5" />
            <span>{session.email.split('@')[0]}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--sea-ink-soft)] text-xs font-bold uppercase tracking-tight opacity-60">
            <Home className="h-3.5 w-3.5" />
            <span>{session.householdId?.slice(0, 6)}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 text-[var(--sea-ink-soft)] text-xs font-bold uppercase tracking-tight">
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
    </div>
  )
}
