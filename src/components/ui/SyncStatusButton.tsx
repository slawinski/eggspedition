import { useState, useRef, useEffect } from 'react'
import { CloudOff, AlertTriangle } from 'lucide-react'
import SyncStatusPanel from './SyncStatusPanel'
import type { QueuedMutation } from '../../lib/mutation-queue'
import styles from './SyncStatus.module.css'

interface SyncStatusButtonProps {
  /** Whether the browser / device is online. */
  isOnline: boolean
  /** Queued mutations waiting to be sent. */
  pendingMutations: QueuedMutation[]
  /** Failed mutations that need user attention. */
  failedMutations: QueuedMutation[]
  /** Called to retry a specific queued mutation. */
  onRetry: (id: string) => void
  /** Called to discard a specific queued mutation. */
  onDiscard: (id: string) => void
}

/**
 * SyncStatusButton — a compact button in the header that shows the
 * current sync state and opens a panel listing pending/failed operations.
 *
 * States:
 * - Online + no pending → hidden/minimal (silence is success)
 * - Offline + no queued   → cloud-off icon, "Offline"
 * - Offline + queued      → badge with count "3 changes waiting"
 * - Failed                → "1 change needs help" attention state
 */
export default function SyncStatusButton({
  isOnline,
  pendingMutations,
  failedMutations,
  onRetry,
  onDiscard,
}: SyncStatusButtonProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    if (panelOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [panelOpen])

  const hasPending = pendingMutations.length > 0
  const hasFailed = failedMutations.length > 0
  const totalQueued = pendingMutations.length + failedMutations.length

  // Determine visual state
  let visualState: 'clean' | 'offline' | 'offlineQueued' | 'attention' = 'clean'
  if (hasFailed) {
    visualState = 'attention'
  } else if (!isOnline && hasPending) {
    visualState = 'offlineQueued'
  } else if (!isOnline) {
    visualState = 'offline'
  }

  const stateClass =
    visualState === 'offline'        ? styles.offline :
    visualState === 'offlineQueued'  ? styles.offlineQueued :
    visualState === 'attention'      ? styles.attention :
    styles.onlineClean

  let label = ''
  if (hasFailed) {
    const count = failedMutations.length
    label = `${count} change${count > 1 ? 's' : ''} need${count === 1 ? 's' : ''} help`
  } else if (!isOnline && hasPending) {
    const count = pendingMutations.length
    label = `${count} change${count > 1 ? 's' : ''} waiting`
  } else if (!isOnline) {
    label = 'Offline'
  }

  const buttonLabel = label || 'Synced — tap for details'
  const Icon = hasFailed ? AlertTriangle : CloudOff

  return (
    <div className={styles.wrapper} ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`${styles.button} ${stateClass}`}
        onClick={() => setPanelOpen((o) => !o)}
        aria-label={buttonLabel}
        aria-haspopup="true"
        aria-expanded={panelOpen}
      >
        {visualState !== 'clean' && (
          <Icon className={styles.buttonIcon} aria-hidden="true" />
        )}
        {totalQueued > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {totalQueued > 9 ? '9+' : totalQueued}
          </span>
        )}
        <span className={styles.label}>{label}</span>
      </button>

      {panelOpen && (
        <SyncStatusPanel
          isOnline={isOnline}
          pendingMutations={pendingMutations}
          failedMutations={failedMutations}
          onRetry={(id) => { onRetry(id); setPanelOpen(false) }}
          onDiscard={(id) => { onDiscard(id); setPanelOpen(false) }}
        />
      )}
    </div>
  )
}
