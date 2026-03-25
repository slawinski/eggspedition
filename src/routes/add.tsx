import { createFileRoute, redirect } from '@tanstack/react-router'
import { addGroceryItemFn } from '../services/grocery.api'
import { z } from 'zod'
import styles from './add.module.css'

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
    <div className={styles.page}>
      <div className={`island-shell ${styles.card}`}>
        <h2 className={styles.title}>Deep Link Error</h2>
        <p className={styles.message}>{error || 'Adding item...'}</p>
        <a
          href="/"
          className={styles.link}
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
