import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Content */}
      <div 
        ref={modalRef}
        className="island-shell relative w-full max-w-lg overflow-hidden rounded-[2rem] p-6 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[var(--sea-ink)]">{title}</h3>
          <button 
            onClick={onClose}
            className="rounded-full p-2 hover:bg-[var(--line)] transition-colors text-[var(--sea-ink-soft)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="relative">
          {children}
        </div>
      </div>
    </div>
  )
}
