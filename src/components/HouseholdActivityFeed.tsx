import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getHouseholdLogsFn, addGroceryItemFn } from '../services/grocery.api'
import { useRouteContext, useNavigate } from '@tanstack/react-router'
import styles from './HouseholdActivityFeed.module.css'
import { History, PlusCircle, CheckCircle2, RotateCcw, Trash2, Pencil } from 'lucide-react'
import Skeleton from './ui/Skeleton'
import EmptyState from './ui/EmptyState'
import InlineError from './ui/InlineError'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivityAction = 'add' | 'update' | 'check' | 'uncheck' | 'remove' | 'restore'

interface HouseholdLog {
  id: string
  action: ActivityAction
  itemName: string
  timestamp: string
  userName: string | null
  userEmail: string | null
}

interface DateGroup {
  label: string
  entries: HouseholdLog[]
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function formatActionCopy(
  action: ActivityAction,
  userName: string | null,
  userEmail: string | null,
  itemName: string,
): string {
  const who = userName || userEmail?.split('@')[0] || 'A household member'

  switch (action) {
    case 'add':
      return `${who} added ${itemName}.`
    case 'check':
      return `${who} completed ${itemName}.`
    case 'uncheck':
      return `${who} restored ${itemName}.`
    case 'remove':
      return `${who} deleted ${itemName}.`
    case 'update':
      return `${who} changed ${itemName}.`
    case 'restore':
      return `${who} restored ${itemName}.`
    default:
      return `${who} changed ${itemName}.`
  }
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function groupByDate(logs: HouseholdLog[]): DateGroup[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  const groups: Record<string, HouseholdLog[]> = {}

  for (const log of logs) {
    const date = new Date(log.timestamp)
    const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

    let label: string
    if (dateKey === today.getTime()) {
      label = 'Today'
    } else if (dateKey === yesterday.getTime()) {
      label = 'Yesterday'
    } else {
      label = date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    }

    if (!groups[label]) groups[label] = []
    groups[label].push(log)
  }

  // Respect insertion order: Today → Yesterday → rest (oldest to newest)
  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (a === 'Today') return -1
      if (b === 'Today') return 1
      if (a === 'Yesterday') return -1
      if (b === 'Yesterday') return 1
      return 0
    })
    .map(([label, entries]) => ({ label, entries: entries.reverse() }))
}

function getActionIcon(action: ActivityAction): React.ReactNode {
  const iconProps = { size: 20 }

  switch (action) {
    case 'add':
      return <PlusCircle {...iconProps} style={{ color: 'var(--accent-coral)' }} />
    case 'check':
      return <CheckCircle2 {...iconProps} style={{ color: 'var(--accent-mint)' }} />
    case 'uncheck':
    case 'restore':
      return <RotateCcw {...iconProps} style={{ color: 'var(--accent-lavender)' }} />
    case 'remove':
      return <Trash2 {...iconProps} style={{ color: 'var(--sea-ink-soft)' }} />
    case 'update':
      return <Pencil {...iconProps} style={{ color: 'var(--lagoon)' }} />
    default:
      return <History {...iconProps} style={{ color: 'var(--sea-ink-soft)' }} />
  }
}

function canRestore(log: HouseholdLog): boolean {
  // MVP: only removed items can be restored (re-added by name)
  return log.action === 'remove'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HouseholdActivityFeed() {
  const { session } = useRouteContext({ from: '__root__' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: logs, isLoading, error, refetch } = useQuery({
    queryKey: ['household-logs', session?.householdId],
    queryFn: () => getHouseholdLogsFn(),
    enabled: !!session?.householdId,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const typedLogs = (logs ?? []) as HouseholdLog[]

  // Restore mutation — re-add a deleted item by name
  const restoreMutation = useMutation({
    mutationFn: (log: HouseholdLog) =>
      addGroceryItemFn({ data: { name: log.itemName, quantity: '1' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items', session?.householdId] })
      queryClient.invalidateQueries({ queryKey: ['household-logs', session?.householdId] })
    },
  })

  const handleRestore = useCallback(
    (log: HouseholdLog) => {
      if (restoreMutation.isPending) return
      restoreMutation.mutate(log)
    },
    [restoreMutation],
  )

  // ------------------------------------------------------------------
  // Render states
  // ------------------------------------------------------------------

  // Loading
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading activity">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="text" height="48px" />
        ))}
        <span className="sr-only">Loading activity...</span>
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <InlineError
        message="Couldn't load activity."
        onRetry={() => refetch()}
        variant="banner"
      />
    )
  }

  // Empty
  if (!typedLogs || typedLogs.length === 0) {
    return (
      <EmptyState
        icon={<History />}
        title="No household activity yet"
        body="Changes made by you and other household members will appear here."
        action={{
          label: 'Go to the list',
          onClick: () => navigate({ to: '/' }),
        }}
      />
    )
  }

  const groups = groupByDate(typedLogs)

  return (
    <div className={styles.feedContainer}>
      {groups.map((group) => (
        <section key={group.label} className={styles.dateGroup}>
          <h3 className={styles.dateGroupHeader}>{group.label}</h3>

          <ul className={styles.entryList}>
            {group.entries.map((log) => (
              <li key={log.id} className={styles.entry}>
                <div className={styles.entryIcon}>
                  {getActionIcon(log.action)}
                </div>

                <div className={styles.entryContent}>
                  <p className={styles.entryText}>
                    {formatActionCopy(log.action, log.userName, log.userEmail, log.itemName)}
                  </p>

                  <div className={styles.entryMeta}>
                    <time className={styles.relativeTime} dateTime={log.timestamp}>
                      {formatRelativeTime(log.timestamp)}
                    </time>

                    {canRestore(log) && (
                      <button
                        type="button"
                        onClick={() => handleRestore(log)}
                        className={styles.restoreBtn}
                        disabled={restoreMutation.isPending}
                      >
                        <RotateCcw size={14} className={styles.restoreIcon} aria-hidden="true" />
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
