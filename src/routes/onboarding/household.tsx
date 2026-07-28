import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Home, UserPlus, Loader2 } from 'lucide-react'
import { z } from 'zod'
import HouseholdChoiceCard from '../../components/onboarding/HouseholdChoiceCard'
import InviteInput from '../../components/onboarding/InviteInput'
import OnboardingProgress from '../../components/onboarding/OnboardingProgress'
import {
  createHouseholdFn,
  acceptHouseholdInviteFn,
} from '../../services/household.api'
import styles from './household.module.css'

export const Route = createFileRoute('/onboarding/household')({
  validateSearch: z.object({
    name: z.string().optional().catch(undefined),
    quantity: z.string().optional().catch(undefined),
    category: z.string().optional().catch(undefined),
    store: z.string().optional().catch(undefined),
  }),
  beforeLoad: ({ context, search }) => {
    // Must be authenticated
    if (!context.session) {
      // Pass deep-link params through login
      throw redirect({
        to: '/login',
        search: {
          returnTo: '/onboarding/household',
          name: search.name,
          quantity: search.quantity,
          category: search.category,
          store: search.store,
        },
      })
    }
    // Already has a household — redirect to list, preserving add intent
    if (context.session.householdId) {
      const hasAddParams = search.name || search.quantity || search.category || search.store
      throw redirect({
        to: '/',
        search: hasAddParams ? {
          add: 'item' as const,
          name: search.name,
          quantity: search.quantity,
          category: search.category,
          store: search.store,
        } : undefined,
      })
    }
  },
  component: HouseholdOnboarding,
})

function HouseholdOnboarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const search = Route.useSearch()
  const [step, setStep] = useState<'choose' | 'join'>('choose')
  const [joinError, setJoinError] = useState<string>()
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)

  const createHousehold = useServerFn(createHouseholdFn)
  const acceptInvite = useServerFn(acceptHouseholdInviteFn)

  // Build the post-setup destination: list page with any preserved deep-link params
  const buildListDestination = () => {
    const hasAddParams = search.name || search.quantity || search.category || search.store
    return {
      to: '/' as const,
      search: hasAddParams ? {
        add: 'item' as const,
        name: search.name,
        quantity: search.quantity,
        category: search.category,
        store: search.store,
      } : undefined,
      replace: true as const,
    }
  }

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      await createHousehold({ data: {} })
      queryClient.invalidateQueries()
      const dest = buildListDestination()
      navigate(dest)
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Failed to create household')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoin = async (token: string) => {
    setJoinError(undefined)
    setIsJoining(true)
    try {
      await acceptInvite({ data: token })
      queryClient.invalidateQueries()
      const dest = buildListDestination()
      navigate(dest)
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join household')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.container}>
        <OnboardingProgress currentStep={1} totalSteps={2} />

        <h1 className={styles.title}>Set up your household</h1>
        <p className={styles.subtitle}>
          Create a new shared list for your family, or join an existing one
        </p>

        {step === 'choose' ? (
          <div className={styles.choices}>
            <HouseholdChoiceCard
              icon={<Home size={32} aria-hidden="true" />}
              title="Start a household"
              description="Create a fresh grocery list and invite others later"
              onClick={handleCreate}
            />
            <HouseholdChoiceCard
              icon={<UserPlus size={32} aria-hidden="true" />}
              title="Join a household"
              description="Use an invite link from someone already using Eggspedition"
              onClick={() => setStep('join')}
            />
          </div>
        ) : (
          <div className={styles.joinSection}>
            <InviteInput
              onSubmit={handleJoin}
              isPending={isJoining}
              error={joinError}
            />
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => {
                setStep('choose')
                setJoinError(undefined)
              }}
            >
              ← Back
            </button>
          </div>
        )}

        {isCreating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--sea-ink-soft)', fontSize: '0.875rem' }}>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Creating your household...
          </div>
        )}
      </div>
    </main>
  )
}
