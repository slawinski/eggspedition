import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  /** Optional decorative icon rendered above the title. */
  icon?: ReactNode
  /** Required headline. */
  title: string
  /** Optional body copy. */
  body?: string
  /** Optional call-to-action button. */
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * EmptyState — a centred clay container for zero-data screens.
 *
 * Renders a soft clay card with an optional icon, a Fraunces
 * title, explanatory body text, and an optional CTA button.
 */
export default function EmptyState({
  icon,
  title,
  body,
  action,
}: EmptyStateProps) {
  return (
    <div className={styles.container}>
      {icon && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className={styles.title}>{title}</h2>
      {body && <p className={styles.body}>{body}</p>}
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
