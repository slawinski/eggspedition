import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { joinHouseholdFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
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
      // We invalidate everything and force a refresh to get the new session data if possible
      // In a real app, we'd update the session cookie, but here we just invalidate router
      queryClient.invalidateQueries()
      router.invalidate()
      window.location.reload() // Hard reload to ensure middleware picks up new household if needed
    },
  })

  const handleCopy = () => {
    navigator.clipboard.writeText(householdId)
    setCheck(true)
    setTimeout(() => setCheck(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4 mt-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowJoin(!showJoin)}
          className="flex items-center gap-2 text-xs font-bold text-[var(--sea-ink-soft)] hover:text-[#a18cd1] transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          <span>{showJoin ? 'Cancel' : 'Join Household'}</span>
        </button>
        
        <div className="h-4 w-[1px] bg-[var(--line)]" />

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs font-bold text-[var(--sea-ink-soft)] hover:text-[#84fab0] transition-colors"
        >
          {copied ? <Check className="h-4 w-4 text-[#84fab0]" /> : <Share2 className="h-4 w-4" />}
          <span>{copied ? 'Copied ID!' : 'Share Household ID'}</span>
        </button>
      </div>

      {showJoin && (
        <div className={`${styles.card} !p-4 flex gap-2 animate-in fade-in slide-in-from-top-2 !rounded-2xl`}>
          <input
            type="text"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Paste Household ID..."
            className={`${styles.input} !py-1 text-sm`}
          />
          <button
            onClick={() => joinMutation.mutate(joinId)}
            disabled={joinMutation.isPending || !joinId.trim()}
            className={`${styles.button} !p-2 flex items-center justify-center`}
          >
            <LogIn className="h-4 w-4 text-white" />
          </button>
        </div>
      )}
    </div>
  )
}
