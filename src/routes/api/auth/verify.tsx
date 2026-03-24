import { createFileRoute, redirect } from '@tanstack/react-router'
import { verifyMagicLinkServerFn } from '../../../services/auth.api'
import utils from '../../../styles/utils.module.css'

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
    <div className={`${utils.flex} ${utils.justifyCenter} ${utils.itemsCenter}`} style={{ height: '100vh', backgroundColor: '#fdf6f0' }}>
      <div className={`${utils.p8} ${utils.rounded2xl}`} style={{ backgroundColor: 'white', boxShadow: '8px 8px 16px rgba(174, 174, 192, 0.4)' }}>
        <h2 className={`${utils.mb4}`} style={{ color: '#ff9a9e' }}>Oops! 🥚</h2>
        <p className={`${utils.mb4}`}>{error}</p>
        <a href="/login" className={`${utils.fontBold}`} style={{ color: '#a18cd1', textDecoration: 'none' }}>Try logging in again</a>
      </div>
    </div>
  )
}
