import { Users, Loader2, X, Check } from 'lucide-react'
import styles from './InvitePreview.module.css'

interface InvitePreviewProps {
  householdName: string
  inviterEmail: string
  onAccept: () => void
  onDecline: () => void
  isPending: boolean
  error?: string
}

export default function InvitePreview({
  householdName,
  inviterEmail,
  onAccept,
  onDecline,
  isPending,
  error,
}: InvitePreviewProps) {
  return (
    <div className={styles.card}>
      <Users className={styles.icon} aria-hidden="true" />
      <h2 className={styles.heading}>
        You've been invited to join{' '}
        <span className={styles.householdName}>{householdName}</span>
      </h2>
      <p className={styles.subtext}>
        Invited by <span className={styles.inviter}>{inviterEmail}</span>
      </p>
      {error && (
        <p className={styles.subtext} style={{ color: 'var(--danger)', fontWeight: 600 }}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.acceptBtn}
          onClick={onAccept}
          disabled={isPending}
          aria-label={`Accept invite to join ${householdName}`}
        >
          {isPending ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <Check size={18} aria-hidden="true" />
          )}
          Accept
        </button>
        <button
          type="button"
          className={styles.declineBtn}
          onClick={onDecline}
          disabled={isPending}
          aria-label="Decline invite"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
