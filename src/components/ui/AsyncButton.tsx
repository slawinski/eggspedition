import { useState, useEffect, useRef, useId, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import styles from './AsyncButton.module.css'

export type AsyncButtonStatus = 'idle' | 'pending' | 'success' | 'error'

interface AsyncButtonProps {
  status: AsyncButtonStatus
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  'aria-label'?: string
}

/**
 * AsyncButton — a claymorphism-styled button with built-in
 * pending / success / error states and brief feedback animations.
 *
 * After a success or error state, the button automatically
 * resets to 'idle' after 1.5 s so it is ready for the next action.
 */
export default function AsyncButton({
  status,
  onClick,
  disabled = false,
  children,
  'aria-label': ariaLabel,
}: AsyncButtonProps) {
  const buttonId = useId()
  const [internalStatus, setInternalStatus] = useState<AsyncButtonStatus>(status)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setInternalStatus(status)

    // Auto-reset success/error back to idle after a brief display
    if (status === 'success' || status === 'error') {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setInternalStatus('idle')
      }, 1500)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [status])

  const isPending = internalStatus === 'pending'
  const isSuccess = internalStatus === 'success'
  const isError = internalStatus === 'error'
  const isInteractive = internalStatus === 'idle' && !disabled

  const statusClass =
    isPending ? styles.pending :
    isSuccess ? styles.success :
    isError   ? styles.error :
    ''

  const ariaLabelText = ariaLabel ?? (typeof children === 'string' ? children : undefined)

  const renderContent = () => {
    if (isPending) {
      return (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          <span>{children}</span>
        </>
      )
    }
    if (isSuccess) {
      return (
        <span className={styles.checkmark} aria-hidden="true">
          <Check size={18} strokeWidth={3} />
        </span>
      )
    }
    if (isError) {
      return (
        <span aria-hidden="true">
          <X size={18} strokeWidth={3} />
        </span>
      )
    }
    return children
  }

  return (
    <button
      type="button"
      id={buttonId}
      className={`${styles.button} ${statusClass}`}
      disabled={!isInteractive}
      onClick={onClick}
      aria-label={ariaLabelText}
      aria-busy={isPending}
      aria-live="polite"
    >
      {renderContent()}
    </button>
  )
}
