import { useQuery } from '@tanstack/react-query'
import { getHouseholdLogsFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import utils from '../styles/utils.module.css'
import { History, PlusCircle, CheckCircle, XCircle, RefreshCcw } from 'lucide-react'

export default function HouseholdActivityFeed() {
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['household-logs'],
    queryFn: () => getHouseholdLogsFn(),
  })

  if (isLoading) return (
    <div className={`${utils.flex} ${utils.justifyCenter} ${utils.p8}`}>
      <RefreshCcw className={`${utils.iconLg} ${utils.animateSpin}`} style={{ color: '#a18cd1' }} />
    </div>
  )

  if (error) {
    return (
      <div className={`${styles.card} ${utils.p4}`} style={{ borderColor: 'rgba(255, 154, 158, 0.2)' }}>
        <p className={`${utils.textXs} ${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.fontBold}`} style={{ color: '#ff9a9e' }}>
          <XCircle className={utils.icon} /> Failed to load activity logs.
        </p>
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    return (
      <div className={`${utils.p8} ${utils.textCenter} ${utils.textSm} ${utils.opacity60}`} style={{ color: 'var(--sea-ink-soft)', fontStyle: 'italic' }}>
        No recent activity yet.
      </div>
    )
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'add': return <PlusCircle className={utils.icon} style={{ color: '#ff9a9e' }} />
      case 'check': return <CheckCircle className={utils.icon} style={{ color: '#84fab0' }} />
      case 'uncheck': return <RefreshCcw className={utils.icon} style={{ color: '#a18cd1' }} />
      case 'remove': return <XCircle className={utils.icon} style={{ color: '#9ca3af' }} />
      default: return <History className={utils.icon} />
    }
  }

  return (
    <div className={`${utils.flex} ${utils.flexCol} ${utils.gap3} ${utils.pr2}`} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
      {logs.map((log: any) => (
        <div key={log.id} className={`${utils.flex} ${utils.itemsCenter} ${utils.justifyBetween} ${utils.textXs} ${utils.animateIn} ${utils.py1}`} style={{ borderBottom: '1px solid var(--line)' }}>
          <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2}`}>
            {getActionIcon(log.action)}
            <span style={{ color: 'var(--sea-ink)' }}>
              <span className={utils.fontSemibold} style={{ color: '#a18cd1' }}>
                {log.userName || log.userEmail?.split('@')[0] || 'Member'}
              </span>{' '}
              {log.action}{' '}
              <span className={utils.fontSemibold}>{log.itemName}</span>
            </span>
          </div>
          <span className={`${utils.opacity60}`} style={{ color: 'var(--sea-ink-soft)' }}>
            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  )
}
