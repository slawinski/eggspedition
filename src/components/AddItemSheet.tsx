import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Check } from 'lucide-react'
import type { RefObject } from 'react'
import AddItemForm from './AddItemForm'
import styles from './AddItemSheet.module.css'

interface AddItemSheetProps {
  isOpen: boolean
  onClose: () => void
  triggerRef?: RefObject<HTMLButtonElement | null>
  initialName?: string
  initialQuantity?: string
  initialCategory?: string
  initialStore?: string
}

export default function AddItemSheet({
  isOpen,
  onClose,
  triggerRef,
  initialName,
  initialQuantity,
  initialCategory,
  initialStore,
}: AddItemSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync isOpen with dialog state
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
    }

    if (!isOpen && dialog.open) {
      dialog.close()
      // Clean up any pending status timer
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current)
        statusTimerRef.current = null
      }
      setStatusMessage('')
    }
  }, [isOpen])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current)
      }
    }
  }, [])

  // Handle backdrop click
  function handleDialogClick(
    event: React.MouseEvent<HTMLDialogElement>,
  ) {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  // Handle Escape / dialog cancel
  function handleCancel(
    event: React.SyntheticEvent<HTMLDialogElement>,
  ) {
    event.preventDefault()
    onClose()
  }

  // Restore focus to trigger on close
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleClose() {
      if (!isOpen) return
      // Focus the FAB after the dialog closes
      requestAnimationFrame(() => {
        triggerRef?.current?.focus()
      })
    }

    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [isOpen, triggerRef])

  const clearStatusAfterDelay = useCallback(
    (message: string) => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current)
      }
      setStatusMessage(message)
      statusTimerRef.current = setTimeout(() => {
        setStatusMessage((prev) =>
          prev === message ? '' : prev,
        )
        statusTimerRef.current = null
      }, 2500)
    },
    [],
  )

  const handleItemAdded = useCallback(
    (result: { name: string; quantity: string }) => {
      clearStatusAfterDelay(`${result.name} added.`)
    },
    [clearStatusAfterDelay],
  )

  return (
    <dialog
      ref={dialogRef}
      id="add-item-sheet"
      className={styles.dialog}
      aria-labelledby="add-item-sheet-title"
      onClick={handleDialogClick}
      onCancel={handleCancel}
    >
      <div className={styles.sheet}>
        {/* Header: drag handle + title + close */}
        <div className={styles.header}>
          <div className={styles.dragHandle} aria-hidden="true">
            <span className={styles.dragHandleBar} />
          </div>
          <div className={styles.headerRow}>
            <h2 id="add-item-sheet-title" className={styles.title}>
              Add to your list
            </h2>
            <button
              type="button"
              className={styles.closeButton}
              aria-label="Close add item panel"
              onClick={onClose}
            >
              <X aria-hidden="true" className={styles.closeIcon} />
            </button>
          </div>
        </div>

        {/* Composer: input + Add button */}
        <div className={styles.composer}>
        {isOpen && (
          <AddItemForm
            variant="sheet"
            autoFocus
            onItemAdded={handleItemAdded}
            initialName={initialName}
            initialQuantity={initialQuantity}
            initialCategory={initialCategory}
            initialStore={initialStore}
            key={initialName ?? 'default'}
          />
        )}
        </div>

        {/* Status area */}
        {statusMessage && (
          <div
            aria-live="polite"
            aria-atomic="true"
            className={styles.status}
          >
            <Check
              aria-hidden="true"
              className={styles.statusIcon}
            />
            {statusMessage}
          </div>
        )}

        {/* Footer safe area */}
        <div className={styles.footerSafeArea} />
      </div>
    </dialog>
  )
}
