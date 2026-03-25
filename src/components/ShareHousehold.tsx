import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { joinHouseholdFn } from '../services/grocery.api'
import clay from '../styles/clay.module.css'
import styles from './ShareHousehold.module.css'
import { Share2, UserPlus, Check, LogIn } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'

interface ShareHouseholdProps {
  householdId: string
}

export default function ShareHousehold({ householdId }: ShareHouseholdProps) {
  const [copied, setCheck] = useState(false)
  const [joinId, setJoinId] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()

  const joinMutation = useMutation({
    mutationFn: (id: string) => joinHouseholdFn({ data: id }),
    onSuccess: () => {
      setJoinId('')
      setShowJoin(false)
      queryClient.invalidateQueries()
      router.invalidate()
      window.location.reload()
    },
  })

  const handleCopy = () => {
    navigator.clipboard.writeText(householdId)
    setCheck(true)
    setTimeout(() => setCheck(false), 2000)
  }

  return (
    <div className={styles.container}>
      <div className={styles.actionsWrapper}>
        <button
          onClick={() => setShowJoin(!showJoin)}
          className={styles.actionButton}
        >
          <UserPlus className={styles.actionIcon} />
          <span>{showJoin ? 'Cancel' : 'Join Household'}</span>
        </button>
        
        <div className={styles.divider} />

        <button
          onClick={handleCopy}
          className={styles.actionButton}
        >
          {copied ? <Check className={styles.successIcon} /> : <Share2 className={styles.actionIcon} />}
          <span>{copied ? 'Copied ID!' : 'Share Household ID'}</span>
        </button>
      </div>

      {showJoin && (
        <div className={`${clay.card} ${styles.joinForm}`}>
          <input
            type="text"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Paste Household ID..."
            className={`${clay.input} ${styles.joinInput}`}
          />
          <button
            onClick={() => joinMutation.mutate(joinId)}
            disabled={joinMutation.isPending || !joinId.trim()}
            className={`${clay.button} ${styles.joinButton}`}
          >
            <LogIn className={styles.joinIcon} />
          </button>
        </div>
      )}
    </div>
  )
}
