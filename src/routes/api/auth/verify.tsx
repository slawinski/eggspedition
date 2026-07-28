import { createFileRoute, redirect } from '@tanstack/react-router'
import { verifyMagicLinkServerFn } from '../../../services/auth.api'
import { resolvePostAuthDestination } from '../../../lib/post-auth-router'
import styles from './verify.module.css'

export const Route = createFileRoute('/api/auth/verify')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string,
    returnTo: search.returnTo as string | undefined,
    name: search.name as string | undefined,
    quantity: search.quantity as string | undefined,
    category: search.category as string | undefined,
    store: search.store as string | undefined,
    invite: search.invite as string | undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps: search }) => {
    const result = await verifyMagicLinkServerFn({ data: search.token })
    
    if (result.success) {
      const destination = resolvePostAuthDestination({
        returnTo: search.returnTo,
        invite: search.invite,
        name: search.name,
        quantity: search.quantity,
        category: search.category,
        store: search.store,
        hasHousehold: result.hasHousehold,
      })
      throw redirect({
        to: destination.to as any,
        search: destination.search as any,
        replace: true,
      })
    }
    
    return { error: 'Invalid or expired magic link.' }
  },
  component: VerifyComponent,
})

function VerifyComponent() {
  const { error } = Route.useLoaderData()

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.title}>This link has expired</h2>
        <p className={styles.message}>{error}</p>
        <p className={styles.hint}>
          Sign-in links are valid for 15 minutes. Request a new one to continue.
        </p>
        <a href="/login" className={styles.actionButton}>Send a new link</a>
      </div>
    </div>
  )
}
