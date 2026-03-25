import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import styles from './Modal.module.css'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      {/* Overlay */}
      <div 
        className={styles.backdrop}
        onClick={onClose}
      />
      
      {/* Content */}
      <div 
        ref={modalRef}
        className={styles.content}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button 
            onClick={onClose}
            className={styles.closeButton}
          >
            <X className={styles.closeIcon} />
          </button>
        </div>
        
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  )
}
