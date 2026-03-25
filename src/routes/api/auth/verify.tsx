import { createFileRoute, redirect } from '@tanstack/react-router'
import { verifyMagicLinkServerFn } from '../../../services/auth.api'
import styles from './verify.module.css'

export const Route = createFileRoute('/api/auth/verify')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string,
    returnTo: search.returnTo as string | undefined,
    name: search.name as string | undefined,
    quantity: search.quantity as string | undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps: search }) => {
    const { success } = await verifyMagicLinkServerFn({ data: search.token })
    
    if (success) {
      if (search.returnTo) {
        throw redirect({ 
          to: search.returnTo as any,
          search: {
            name: search.name,
            quantity: search.quantity,
          } as any
        })
      }
      throw redirect({ to: '/' })
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
        <h2 className={styles.title}>Oops! 🥚</h2>
        <p className={styles.message}>{error}</p>
        <a href="/login" className={styles.link}>Try logging in again</a>
      </div>
    </div>
  )
}
