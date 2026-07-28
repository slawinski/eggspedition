import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { previewHouseholdInviteFn, acceptHouseholdInviteFn } from '../../services/household.api'
import InvitePreview from '../../components/onboarding/InvitePreview'
import styles from './join.module.css'

export const Route = createFileRoute('/join/$token')({
  beforeLoad: ({ context, params }) => {
    // If not authenticated, redirect to login with returnTo
    if (!context.session) {
      throw redirect({
        to: '/login',
        search: { returnTo: `/join/${params.token}` },
      })
    }
  },
  loader: async ({ params }) => {
    const preview = await previewHouseholdInviteFn({ data: params.token })
    return { preview, token: params.token }
  },
  component: JoinHousehold,
})

function JoinHousehold() {
  const { preview, token } = Route.useLoaderData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)
  const [acceptError, setAcceptError] = useState<string>()

  const acceptInvite = useServerFn(acceptHouseholdInviteFn)

  // Loading state (while preview is being fetched on client navigation)
  if (!preview) {
    return (
      <main id="main-content" className={styles.page}>
        <div className={styles.loading}>
          <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          <span>Loading invite...</span>
        </div>
      </main>
    )
  }

  const handleAccept = async () => {
    setAcceptError(undefined)
    setIsPending(true)
    try {
      await acceptInvite({ data: token })
      queryClient.invalidateQueries()
      navigate({ to: '/', replace: true })
    } catch (err: unknown) {
      setAcceptError(err instanceof Error ? err.message : 'Failed to join household')
    } finally {
      setIsPending(false)
    }
  }

  const handleDecline = () => {
    navigate({ to: '/onboarding/household' })
  }

  // Error states for invalid/expired/revoked/redeemed invites
  if (preview.status !== 'valid') {
    return (
      <main id="main-content" className={styles.page}>
        <div className={styles.container}>
          <div className={styles.errorCard}>
            <h2 className={styles.errorTitle}>
              {preview.status === 'expired'
                ? 'Invite expired'
                : preview.status === 'revoked'
                  ? 'Invite revoked'
                  : preview.status === 'redeemed'
                    ? 'Already used'
                    : 'Invite not found'}
            </h2>
            <p className={styles.errorMessage}>
              {preview.status === 'expired'
                ? 'This invite link has expired. Ask your household admin to send a new one.'
                : preview.status === 'revoked'
                  ? 'This invite has been revoked by the household admin.'
                  : preview.status === 'redeemed'
                    ? 'This invite has already been used.'
                    : "We couldn't find this invite. It may have been removed or the link is incorrect."}
            </p>
            <Link to="/onboarding/household" className={styles.actionLink}>
              Set up your household
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Valid invite
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.container}>
        <InvitePreview
          householdName={preview.householdName}
          inviterEmail={preview.inviterEmail}
          onAccept={handleAccept}
          onDecline={handleDecline}
          isPending={isPending}
          error={acceptError}
        />
      </div>
    </main>
  )
}
