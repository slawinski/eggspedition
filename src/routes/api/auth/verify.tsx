import { createFileRoute, redirect } from '@tanstack/react-router'
import { verifyMagicLinkServerFn } from '../../../services/auth.api'

export const Route = createFileRoute('/api/auth/verify')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string,
    returnTo: search.returnTo as string | undefined,
    name: search.name as string | undefined,
    quantity: search.quantity as string | undefined,
  }),
  loader: async ({ search }) => {
    const { success } = await verifyMagicLinkServerFn({ data: search.token })
    
    if (success) {
      if (search.returnTo) {
        throw redirect({ 
          to: search.returnTo as any,
          search: {
            name: search.name,
            quantity: search.quantity,
          }
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#fdf6f0' }}>
      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '2rem', boxShadow: '8px 8px 16px rgba(174, 174, 192, 0.4)' }}>
        <h2 style={{ color: '#ff9a9e' }}>Oops! 🥚</h2>
        <p>{error}</p>
        <a href="/login" style={{ color: '#a18cd1', textDecoration: 'none', fontWeight: 'bold' }}>Try logging in again</a>
      </div>
    </div>
  )
}
