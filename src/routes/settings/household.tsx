import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { ArrowLeft, UserPlus, Trash2, Loader2 } from 'lucide-react'
import HouseholdShareActions from '../../components/onboarding/HouseholdShareActions'
import {
  getHouseholdMembersFn,
  getPendingInvitesFn,
  getHouseholdMemberCountFn,
  createHouseholdInviteFn,
  revokeHouseholdInviteFn,
  updateHouseholdNameFn,
} from '../../services/household.api'
import styles from './household.module.css'

export const Route = createFileRoute('/settings/household')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    if (!context.session.householdId) {
      throw redirect({ to: '/onboarding/household' })
    }
  },
  loader: async ({ context }) => {
    if (!context.session?.householdId) return null

    const { queryClient } = context
    const householdId = context.session.householdId

    await Promise.all([
      queryClient.ensureQueryData({
        queryKey: ['household-members', householdId],
        queryFn: () => getHouseholdMembersFn(),
      }),
      queryClient.ensureQueryData({
        queryKey: ['pending-invites', householdId],
        queryFn: () => getPendingInvitesFn(),
      }),
      queryClient.ensureQueryData({
        queryKey: ['household-member-count', householdId],
        queryFn: () => getHouseholdMemberCountFn(),
      }),
    ])

    return { householdId }
  },
  component: HouseholdSettings,
})

function HouseholdSettings() {
  const { session } = Route.useRouteContext()
  const householdId = session?.householdId
  const queryClient = useQueryClient()

  const createInvite = useServerFn(createHouseholdInviteFn)
  const revokeInvite = useServerFn(revokeHouseholdInviteFn)
  const updateName = useServerFn(updateHouseholdNameFn)

  const [inviteData, setInviteData] = useState<{ id: string; token: string; inviteUrl: string } | null>(null)
  const [newName, setNewName] = useState('')
  const [nameDirty, setNameDirty] = useState(false)

  const { data: memberCount } = useQuery({
    queryKey: ['household-member-count', householdId],
    queryFn: () => getHouseholdMemberCountFn(),
    enabled: !!householdId,
  })

  const { data: pendingInvites, refetch: refetchInvites } = useQuery({
    queryKey: ['pending-invites', householdId],
    queryFn: () => getPendingInvitesFn(),
    enabled: !!householdId,
  })

  const { data: members } = useQuery({
    queryKey: ['household-members', householdId],
    queryFn: () => getHouseholdMembersFn(),
    enabled: !!householdId,
  })

  const createInviteMutation = useMutation({
    mutationFn: () => createInvite({ data: { householdId: householdId! } }),
    onSuccess: (data) => {
      setInviteData(data)
      refetchInvites()
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeInvite({ data: inviteId }),
    onSuccess: () => {
      refetchInvites()
    },
  })

  const nameMutation = useMutation({
    mutationFn: (name: string) => updateName({ data: name }),
    onSuccess: () => {
      queryClient.invalidateQueries()
      setNameDirty(false)
    },
  })

  useEffect(() => {
    // Load current household name from members data
    if (members && members.length > 0 && !nameDirty) {
      // Name is on the household, not on members. Let's get it from session or a query.
      // For now, leave newName empty until user edits.
    }
  }, [members, nameDirty])

  if (!householdId) {
    return (
    <main id="main-content" className={styles.page}>
        <div className={styles.loading}>
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          <span>Loading...</span>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className={styles.page}>
      <Link to="/" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to list
      </Link>

      <h1 className={styles.title}>Household Settings</h1>
      <p className={styles.subtitle}>Manage your household, invite members, and keep your list in sync.</p>

      {/* Household name */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Name</h2>
        <form
          className={styles.nameForm}
          onSubmit={(e) => {
            e.preventDefault()
            if (newName.trim()) {
              nameMutation.mutate(newName.trim())
            }
          }}
        >
          <input
            type="text"
            className={styles.nameInput}
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              setNameDirty(true)
            }}
            placeholder="Household name..."
            aria-label="Household name"
          />
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={!newName.trim() || nameMutation.isPending}
          >
            {nameMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>

      {/* Household info */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Info</h2>
        <div className={styles.infoCard}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Members</span>
            <span className={styles.infoValue}>{memberCount ?? '—'}</span>
          </div>
          {members?.map((m) => (
            <div key={m.userId} className={styles.infoRow}>
              <span className={styles.infoLabel}>{m.role === 'admin' ? 'Admin' : 'Member'}</span>
              <span className={styles.infoValue}>{m.email}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invite section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Invite someone</h2>

        {inviteData ? (
          <HouseholdShareActions
            inviteUrl={inviteData.inviteUrl}
            householdName={newName || 'My Household'}
          />
        ) : (
          <button
            type="button"
            className={styles.inviteBtn}
            onClick={() => createInviteMutation.mutate()}
            disabled={createInviteMutation.isPending}
          >
            {createInviteMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus size={18} aria-hidden="true" />
            )}
            Invite someone
          </button>
        )}

        {/* Pending invites list */}
        {pendingInvites && pendingInvites.length > 0 && (
          <div className={styles.inviteList}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--sea-ink-soft)', margin: 0 }}>
              Active invites
            </h3>
            {pendingInvites.map((inv) => (
              <div key={inv.id} className={styles.inviteItem}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.inviteToken}>{inv.token}</div>
                  <div className={styles.inviteDate}>
                    Created {new Date(inv.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.revokeBtn}
                  onClick={() => revokeMutation.mutate(inv.id)}
                  disabled={revokeMutation.isPending}
                  aria-label={`Revoke invite ${inv.token}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {pendingInvites && pendingInvites.length === 0 && !inviteData && (
          <p className={styles.emptyText}>No active invites yet. Create one to share with your household.</p>
        )}
      </div>
    </main>
  )
}
