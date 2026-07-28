import { useState, useCallback } from 'react'
import { Copy, Share2, Check } from 'lucide-react'
import styles from './HouseholdShareActions.module.css'

interface HouseholdShareActionsProps {
  inviteUrl: string
  householdName: string
}

export default function HouseholdShareActions({
  inviteUrl,
  householdName,
}: HouseholdShareActionsProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [inviteUrl])

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator
        .share({
          title: `Join my household "${householdName}" on Eggspedition`,
          text: `Join "${householdName}" on Eggspedition: ${inviteUrl}`,
          url: inviteUrl,
        })
        .catch(() => {
          // Fallback: copy on share failure
          handleCopy()
        })
    } else {
      handleCopy()
    }
  }, [inviteUrl, householdName, handleCopy])

  return (
    <div className={styles.wrapper}>
      <div className={styles.urlRow}>
        <span className={styles.urlChip}>{inviteUrl}</span>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={handleCopy}
          aria-label="Copy invite link"
        >
          {copied ? (
            <>
              <Check size={16} aria-hidden="true" />
              <span className={styles.copiedLabel}>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={16} aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <button
        type="button"
        className={styles.shareBtn}
        onClick={handleShare}
        aria-label={`Share invite to join ${householdName}`}
      >
        <Share2 size={18} aria-hidden="true" />
        Share invite
      </button>
    </div>
  )
}
