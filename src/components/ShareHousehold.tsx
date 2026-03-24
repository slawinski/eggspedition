import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { joinHouseholdFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import utils from '../styles/utils.module.css'
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
    <div className={`${utils.flex} ${utils.flexCol} ${utils.gap4} ${utils.mt4}`}>
      <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2}`}>
        <button
          onClick={() => setShowJoin(!showJoin)}
          className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.textXs} ${utils.fontBold} ${utils.transitionColors}`}
          style={{ color: 'var(--sea-ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <UserPlus className={utils.icon} />
          <span>{showJoin ? 'Cancel' : 'Join Household'}</span>
        </button>
        
        <div style={{ height: '1rem', width: '1px', backgroundColor: 'var(--line)' }} />

        <button
          onClick={handleCopy}
          className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.textXs} ${utils.fontBold} ${utils.transitionColors}`}
          style={{ color: 'var(--sea-ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {copied ? <Check className={utils.icon} style={{ color: '#84fab0' }} /> : <Share2 className={utils.icon} />}
          <span>{copied ? 'Copied ID!' : 'Share Household ID'}</span>
        </button>
      </div>

      {showJoin && (
        <div className={`${styles.card} ${utils.p4} ${utils.flex} ${utils.gap2} ${utils.animateIn} ${utils.rounded2xl}`}>
          <input
            type="text"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Paste Household ID..."
            className={`${styles.input} ${utils.py1} ${utils.textSm}`}
          />
          <button
            onClick={() => joinMutation.mutate(joinId)}
            disabled={joinMutation.isPending || !joinId.trim()}
            className={`${styles.button} ${utils.p2} ${utils.flex} ${utils.itemsCenter} ${utils.justifyCenter}`}
          >
            <LogIn className={`${utils.icon} ${utils.icon}`} style={{ color: 'white' }} />
          </button>
        </div>
      )}
    </div>
  )
}
