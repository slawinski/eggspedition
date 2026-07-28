import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import styles from './InviteInput.module.css'

interface InviteInputProps {
  onSubmit: (token: string) => void
  isPending: boolean
  error?: string
}

/**
 * Accepts an invite URL or short code.
 * Auto-normalizes spaces, casing, and strips URL prefixes.
 */
export default function InviteInput({ onSubmit, isPending, error }: InviteInputProps) {
  const [value, setValue] = useState('')

  const normalizeToken = (raw: string): string => {
    let cleaned = raw.trim().toLowerCase().replace(/\s+/g, '')

    // Strip URL prefix: https://.../join/TOKEN → TOKEN
    const joinIdx = cleaned.lastIndexOf('/join/')
    if (joinIdx !== -1) {
      cleaned = cleaned.slice(joinIdx + 6)
    }

    // Strip query params and trailing slashes
    cleaned = cleaned.split('?')[0].replace(/\/$/, '')

    return cleaned
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const token = normalizeToken(value)
    if (!token) return
    onSubmit(token)
  }

  return (
    <form onSubmit={handleSubmit} className={styles.wrapper}>
      <div className={styles.inputGroup}>
        <input
          type="text"
          className={styles.field}
          placeholder="Paste invite link or code..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Invite link or code"
          autoComplete="off"
        />
        <button
          type="submit"
          className={styles.submit}
          disabled={isPending || !value.trim()}
          aria-label="Join household"
        >
          {isPending ? (
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight size={20} aria-hidden="true" />
          )}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  )
}
