import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getHouseholdLogsFn, householdSignalFn } from '../services/grocery.api'
import type { HouseholdLog } from '../lib/schemas'
import styles from '../styles/clay.module.css'
import { History, PlusCircle, CheckCircle, XCircle, RefreshCcw } from 'lucide-react'
import { useEffect } from 'react'

function useHouseholdSignals() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const ctrl = new AbortController()
    const connect = async () => {
      try {
        const response = await householdSignalFn({ signal: ctrl.signal })
        const reader = response.body?.getReader()
        if (!reader) return
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          if (chunk.includes('data:')) {
            queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
            queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
            queryClient.invalidateQueries({ queryKey: ['household-logs'] })
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) setTimeout(connect, 3000)
      }
    }
    connect()
    return () => ctrl.abort()
  }, [queryClient])
}

export default function HouseholdActivityFeed() {
  useHouseholdSignals()
  const { data: logs, isLoading } = useQuery({
    queryKey: ['household-logs'],
    queryFn: () => getHouseholdLogsFn(),
  })

  if (isLoading) return null

  if (!logs || logs.length === 0) return null

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
    <div className={`${styles.card} mt-8 p-4`}>
      <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-[var(--sea-ink-soft)]">
        <History className="h-4 w-4" /> Household Activity
      </h3>
      <div className="flex flex-col gap-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
        {logs.map((log: HouseholdLog) => (
          <div key={log.id} className="flex items-center justify-between text-xs animate-in fade-in slide-in-from-left-2">
            <div className="flex items-center gap-2">
              {getActionIcon(log.action)}
              <span className="text-[var(--sea-ink)]">
                <span className="font-semibold">User</span> {log.action}{' '}
                <span className="font-semibold">{log.itemName}</span>
              </span>
            </div>
            <span className="text-[var(--sea-ink-soft)] opacity-60">
              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
