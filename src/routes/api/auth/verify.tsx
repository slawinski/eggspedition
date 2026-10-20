import { createFileRoute, redirect, Link } from '@tanstack/react-router'
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
    
    return { error: 'This sign-in link is invalid or has expired.' }
  },
  component: VerifyComponent,
})

function VerifyComponent() {
  const { error } = Route.useLoaderData()
  const { token: _token, ...intent } = Route.useSearch()

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.title}>This link has expired</h2>
        <p className={styles.message}>{error}</p>
        <p className={styles.hint}>
          Sign in with an email code instead. Return here to enter the code without reinstalling the app.
        </p>
        <Link to="/login" search={intent} className={styles.actionButton}>Request an email code</Link>
      </div>
    </div>
  )
}
