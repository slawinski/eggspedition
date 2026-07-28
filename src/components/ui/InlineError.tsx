import { AlertTriangle, RefreshCw } from 'lucide-react'
import styles from './InlineError.module.css'

interface InlineErrorProps {
  /** Named-action copy, e.g. "Couldn't add Milk." — NOT "Something went wrong". */
  message: string
  /** Optional retry handler. When provided a retry button is rendered. */
  onRetry?: () => void
  /** Layout variant. 'banner' is full-width; 'inline' sits beside content. */
  variant?: 'inline' | 'banner'
}

/**
 * InlineError — a clay-styled error block with built-in retry.
 *
 * Uses `role="alert"` so screen readers announce failures immediately.
 * Prefer concrete copy like "Couldn't add Milk." over vague messages.
 */
export default function InlineError({
  message,
  onRetry,
  variant = 'inline',
}: InlineErrorProps) {
  return (
    <div
      className={`${styles.container} ${variant === 'banner' ? styles.banner : styles.inline}`}
      role="alert"
    >
      <AlertTriangle className={styles.icon} aria-hidden="true" />
      <div className={styles.content}>
        <p className={styles.message}>{message}</p>
        {onRetry && (
          <button
            type="button"
            className={styles.retryButton}
            onClick={onRetry}
            aria-label={`Retry: ${message}`}
          >
            <RefreshCw className={styles.retryIcon} aria-hidden="true" />
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
