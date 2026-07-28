import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/add')({
  validateSearch: z.object({
    name: z.string().optional().catch(undefined),
    quantity: z.string().optional().catch(undefined),
    category: z.string().optional().catch(undefined),
    store: z.string().optional().catch(undefined),
  }),
  beforeLoad: ({ context, search }) => {
    if (!context.session) {
      // Preserve all recognized search params through the login flow
      throw redirect({
        to: '/login',
        search: {
          returnTo: '/add',
          name: search.name,
          quantity: search.quantity,
          category: search.category,
          store: search.store,
        },
        replace: true,
      })
    }
    throw redirect({
      to: '/',
      search: {
        add: 'item' as const,
        name: search.name,
        quantity: search.quantity,
        category: search.category,
        store: search.store,
      },
      replace: true,
    })
  },
})
