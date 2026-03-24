import { createFileRoute, redirect } from '@tanstack/react-router'
import { addGroceryItemFn } from '../services/grocery.api'
import { z } from 'zod'
import utils from '../styles/utils.module.css'

export const Route = createFileRoute('/add')({
  validateSearch: z.object({
    name: z.string().min(1),
    quantity: z.string().optional(),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps: search, context }) => {
    const { session } = context as any
    
    if (!session) {
      throw redirect({
        to: '/login',
        search: {
          returnTo: '/add',
          ...search,
        },
      })
    }

    try {
      await addGroceryItemFn({
        data: {
          name: search.name,
          quantity: search.quantity || '1',
        },
      })
      // After adding, redirect back home
      throw redirect({ to: '/' })
    } catch (err) {
      console.error('Failed to add item via deep link:', err)
      return { error: 'Failed to add item. Please try again.' }
    }
  },
  component: AddDeepLinkComponent,
})

function AddDeepLinkComponent() {
  const { error } = Route.useLoaderData() as any

  return (
    <div className={`${utils.flex} ${utils.itemsCenter} ${utils.justifyCenter} ${utils.p4}`} style={{ minHeight: '100vh' }}>
      <div className={`island-shell ${utils.p8} ${utils.textCenter}`} style={{ borderRadius: '2rem', maxWidth: '24rem' }}>
        <h2 className={`${utils.textLg} ${utils.fontBold} ${utils.mb1}`} style={{ color: '#ff9a9e' }}>Deep Link Error</h2>
        <p className={`${utils.mb4}`} style={{ color: 'var(--sea-ink-soft)' }}>{error || 'Adding item...'}</p>
        <a
          href="/"
          className={`${utils.roundedFull} ${utils.px6} ${utils.py2} ${utils.fontBold}`}
          style={{ 
            background: 'linear-gradient(to right, #ff9a9e, #a18cd1)',
            color: 'white',
            textDecoration: 'none',
            display: 'inline-block'
          }}
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
