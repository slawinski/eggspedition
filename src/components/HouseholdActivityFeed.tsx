import { useQuery } from '@tanstack/react-query'
import { getHouseholdLogsFn } from '../services/grocery.api'
import { Route } from '../routes/index'
import clay from '../styles/clay.module.css'
import styles from './HouseholdActivityFeed.module.css'
import { History, PlusCircle, CheckCircle, XCircle, RefreshCcw } from 'lucide-react'

export default function HouseholdActivityFeed() {
  const { session } = Route.useRouteContext()
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['household-logs', session?.householdId],
    queryFn: () => getHouseholdLogsFn(),
    enabled: !!session?.householdId,
  })

  if (isLoading) return (
    <div className={styles.loaderContainer}>
      <RefreshCcw className={styles.loaderIcon} />
    </div>
  )

  if (error) {
    return (
      <div className={`${clay.card} ${styles.errorCard}`}>
        <p className={styles.errorContent}>
          <XCircle className={styles.actionIcon} /> Failed to load activity logs.
        </p>
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    return (
      <div className={styles.emptyMessage}>
        No recent activity yet.
      </div>
    )
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'add': return <PlusCircle className={styles.actionIcon} style={{ color: '#ff9a9e' }} />
      case 'check': return <CheckCircle className={styles.actionIcon} style={{ color: '#84fab0' }} />
      case 'uncheck': return <RefreshCcw className={styles.actionIcon} style={{ color: '#a18cd1' }} />
      case 'remove': return <XCircle className={styles.actionIcon} style={{ color: '#9ca3af' }} />
      default: return <History className={styles.actionIcon} />
    }
  }

  return (
    <div className={styles.feedContainer}>
      {logs.map((log: any) => (
        <div key={log.id} className={styles.logItem}>
          <div className={styles.logContent}>
            {getActionIcon(log.action)}
            <span className={styles.logText}>
              <span className={styles.userName}>
                {log.userName || log.userEmail?.split('@')[0] || 'Member'}
              </span>{' '}
              {log.action}{' '}
              <span className={styles.itemName}>{log.itemName}</span>
            </span>
          </div>
          <span className={styles.timestamp}>
            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}
