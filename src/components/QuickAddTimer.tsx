import styles from './QuickAddTimer.module.css'

export interface QuickAddTimerProps {
  /** 0–1: fraction of the repeat window remaining (1 = just tapped, 0 = expired). */
  progress: number
  /** Whether the timer is currently active (window is open). */
  isActive: boolean
}

/**
 * Visual repeat-window indicator for the Quick Add buttons.
 *
 * Shows a subtle bottom-edge treatment that shrinks over 1 second and
 * restarts on each tap. The fill uses a coral-to-lavender gradient and a
 * soft clay shadow so it feels like a UI embellishment, not an upload bar.
 *
 * Under `prefers-reduced-motion` the fill stays static and full-width.
 */
export default function QuickAddTimer({
  progress,
  isActive,
}: QuickAddTimerProps) {
  if (!isActive) return null

  const clamped = Math.max(0, Math.min(1, progress))

  return (
    <span
      className={styles.timer}
      aria-hidden="true"
      style={
        { '--qt-progress': clamped } as React.CSSProperties
      }
    />
  )
}
