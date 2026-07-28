import type { ReactNode } from 'react'
import styles from './Toast.module.css'

interface ToastViewportProps {
  children: ReactNode
}

/**
 * ToastViewport — a fixed-position toast container rendered at
 * the root level (in __root.tsx).
 *
 * Positioned at the bottom of the screen, above MobileNav,
 * respecting the safe area.  `role="status"` for normal toasts;
 * individual toast children carry `role="alert"` for failures.
 *
 * This component is a layout shell.  Individual toasts are
 * rendered by the consumer (e.g. an UndoProvider in a future
 * release).  Use `Toast.module.css` classes to style those toasts.
 */
export default function ToastViewport({ children }: ToastViewportProps) {
  return (
    <div className={styles.viewport} role="status" aria-label="Notifications">
      {children}
    </div>
  )
}
