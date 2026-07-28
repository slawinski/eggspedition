import { AlertTriangle } from 'lucide-react'
import styles from './RouteError.module.css'

interface RouteErrorProps {
  error: Error
  /** Optional reset handler. Falls back to `window.location.reload()`. */
  reset?: () => void
}

/**
 * RouteError — Clay-styled error page for route-level failures.
 *
 * Centred clay card with an AlertTriangle icon, title, the error message
 * (or a generic fallback), and a "Try again" button.
 */
export default function RouteError({ error, reset }: RouteErrorProps) {
  const handleReset = () => {
    if (reset) {
      reset()
    } else {
      window.location.reload()
    }
  }

  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">
          <AlertTriangle size={28} />
        </div>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.body}>
          {error?.message || 'An unexpected error occurred.'}
        </p>
        <button type="button" className={styles.action} onClick={handleReset}>
          Try again
        </button>
      </div>
    </main>
  )
}
