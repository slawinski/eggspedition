import { useQuery } from '@tanstack/react-query'
import { getHouseholdLogsFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import { History, PlusCircle, CheckCircle, XCircle, RefreshCcw } from 'lucide-react'

export default function HouseholdActivityFeed() {
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['household-logs'],
    queryFn: () => getHouseholdLogsFn(),
  })

  if (isLoading) return (
    <div className="flex justify-center p-8">
      <RefreshCcw className="h-6 w-6 animate-spin text-[#a18cd1]" />
    </div>
  )

  if (error) {
    return (
      <div className={`${styles.card} p-4 border-[#ff9a9e]/20`}>
        <p className="text-xs text-[#ff9a9e] flex items-center gap-2 font-bold">
          <XCircle className="h-4 w-4" /> Failed to load activity logs.
        </p>
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-[var(--sea-ink-soft)] opacity-60 italic">
        No recent activity yet.
      </div>
    )
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'add': return <PlusCircle className="h-4 w-4 text-[#ff9a9e]" />
      case 'check': return <CheckCircle className="h-4 w-4 text-[#84fab0]" />
      case 'uncheck': return <RefreshCcw className="h-4 w-4 text-[#a18cd1]" />
      case 'remove': return <XCircle className="h-4 w-4 text-gray-400" />
      default: return <History className="h-4 w-4" />
    }
  }

  return (
    <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
      {logs.map((log: any) => (
        <div key={log.id} className="flex items-center justify-between text-xs animate-in fade-in slide-in-from-left-2 py-1 border-b border-[var(--line)] last:border-0">
          <div className="flex items-center gap-2">
            {getActionIcon(log.action)}
            <span className="text-[var(--sea-ink)]">
              <span className="font-semibold text-[#a18cd1]">
                {log.userName || log.userEmail?.split('@')[0] || 'Member'}
              </span>{' '}
              {log.action}{' '}
              <span className="font-semibold">{log.itemName}</span>
            </span>
          </div>
          <span className="text-[var(--sea-ink-soft)] opacity-60">
            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}
