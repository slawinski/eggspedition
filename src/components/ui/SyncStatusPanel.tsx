import { RotateCw, Trash2 } from 'lucide-react'
import type { QueuedMutation } from '../../lib/mutation-queue'
import styles from './SyncStatus.module.css'

interface SyncStatusPanelProps {
  isOnline: boolean
  pendingMutations: QueuedMutation[]
  failedMutations: QueuedMutation[]
  onRetry: (id: string) => void
  onDiscard: (id: string) => void
}

/**
 * SyncStatusPanel — a small dropdown listing pending/failed sync
 * operations grouped by household.  Shows operation type and time
 * (no sensitive data).  Offers retry/discard actions for failed items.
 */
export default function SyncStatusPanel({
  isOnline,
  pendingMutations,
  failedMutations,
  onRetry,
  onDiscard,
}: SyncStatusPanelProps) {
  const grouped = groupByHousehold([...pendingMutations, ...failedMutations])

  if (grouped.size === 0) {
    return (
      <div className={styles.panel} role="dialog" aria-label="Sync status">
        <div className={styles.panelHeader}>Sync status</div>
        <div className={styles.panelEmpty}>All changes are up to date.</div>
      </div>
    )
  }

  return (
    <div className={styles.panel} role="dialog" aria-label="Sync status">
      <div className={styles.panelHeader}>
        {!isOnline ? 'Queued changes (offline)' : failedMutations.length > 0 ? 'Changes needing attention' : 'Sync status'}
      </div>

      {[...grouped.entries()].map(([householdId, mutations]) => (
        <div key={householdId} className={styles.householdGroup}>
          {grouped.size > 1 && (
            <div className={styles.householdLabel}>Household {householdId.slice(0, 8)}</div>
          )}
          {mutations.map((m) => (
            <div key={m.id} className={styles.operation}>
              <div className={styles.operationInfo}>
                <div className={styles.operationType}>{formatOperationType(m.type)}</div>
                <div className={styles.operationTime}>{formatTimestamp(m.timestamp)}</div>
              </div>
              <div className={styles.operationActions}>
                {m.status === 'failed' && (
                  <>
                    <button
                      type="button"
                      className={styles.operationAction}
                      onClick={() => onRetry(m.id)}
                      aria-label={`Retry ${formatOperationType(m.type)}`}
                      title="Retry"
                    >
                      <RotateCw aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`${styles.operationAction} ${styles.operationActionDiscard}`}
                      onClick={() => onDiscard(m.id)}
                      aria-label={`Discard ${formatOperationType(m.type)}`}
                      title="Discard"
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </>
                )}
                {m.status === 'queued' && !isOnline && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sea-ink-soft)', fontStyle: 'italic' }}>
                    waiting
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ── Helpers ── */

function groupByHousehold(mutations: QueuedMutation[]): Map<string, QueuedMutation[]> {
  const map = new Map<string, QueuedMutation[]>()
  for (const m of mutations) {
    const list = map.get(m.householdId) ?? []
    list.push(m)
    map.set(m.householdId, list)
  }
  return map
}

function formatOperationType(type: string): string {
  // Convert camelCase or kebab-case to readable label
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(ts).toLocaleDateString()
}
