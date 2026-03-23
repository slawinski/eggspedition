import { useQueryClient } from '@tanstack/react-query'
import { householdSignalFn } from '../services/grocery.api'
import { useEffect } from 'react'

/**
 * useHouseholdSignals handles the SSE connection to the server.
 * It stays active as long as this component is mounted, ensuring 
 * real-time query invalidation even when the activity modal is closed.
 */
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
            // Invalidate all relevant grocery and log queries
            queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
            queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
            queryClient.invalidateQueries({ queryKey: ['household-logs'] })
            queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })
            queryClient.invalidateQueries({ queryKey: ['frequent-items'] })
          }
        }
      } catch (err) {
        // Reconnect after a delay if not aborted
        if (!ctrl.signal.aborted) setTimeout(connect, 3000)
      }
    }
    connect()
    return () => ctrl.abort()
  }, [queryClient])
}

export default function Signals() {
  useHouseholdSignals()
  return null
}
