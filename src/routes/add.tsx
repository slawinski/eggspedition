import { createFileRoute, redirect } from '@tanstack/react-router'
import { addGroceryItemFn } from '../services/grocery.api'
import { z } from 'zod'

export const Route = createFileRoute('/add')({
  validateSearch: z.object({
    name: z.string().min(1),
    quantity: z.string().optional(),
  }),
  loader: async ({ search, context }) => {
    // We use the middleware context to check for session
    // Since this is a deep link, if no session, we redirect to login with a returnTo param
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="island-shell p-8 rounded-[2rem] text-center max-w-sm">
        <h2 className="text-xl font-bold text-[#ff9a9e] mb-2">Deep Link Error</h2>
        <p className="text-[var(--sea-ink-soft)] mb-6">{error || 'Adding item...'}</p>
        <a
          href="/"
          className="rounded-full bg-gradient-to-r from-[#ff9a9e] to-[#a18cd1] px-6 py-2 text-white font-bold"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
