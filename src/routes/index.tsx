import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import AddItemForm from '../components/AddItemForm'
import SmartView from '../components/SmartView'
import LandingPage from '../components/landing/LandingPage'
import { getGroceryItemsFn, getGroceryItemsGroupedFn, getCategoriesFn, getStoresFn, getHouseholdLogsFn } from '../services/grocery.api'
import styles from './index.module.css'
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { isStandalone } from '../lib/pwa-auth'

export const Route = createFileRoute('/')({
  validateSearch: z.object({
    add: z.literal('item').optional().catch(undefined),
    name: z.string().optional().catch(undefined),
    quantity: z.string().optional().catch(undefined),
    category: z.string().optional().catch(undefined),
    store: z.string().optional().catch(undefined),
  }),
  beforeLoad: ({ context }) => {
    if (context.session && !context.session.householdId) {
      throw redirect({ to: '/onboarding/household' })
    }
  },
  loader: async ({ context }) => {
    if (!context.session?.householdId) return

    const { queryClient, session } = context
    const householdId = session.householdId

    // Prefetch all data needed for Home sub-components
    await Promise.all([
      queryClient.ensureQueryData({
        queryKey: ['grocery-items', householdId],
        queryFn: () => getGroceryItemsFn(),
      }),
      queryClient.ensureQueryData({
        queryKey: ['grocery-items-grouped', 'category', householdId],
        queryFn: () => getGroceryItemsGroupedFn({ data: 'category' }),
      }),
      queryClient.ensureQueryData({
        queryKey: ['categories', householdId],
        queryFn: () => getCategoriesFn(),
      }),
      queryClient.ensureQueryData({
        queryKey: ['stores', householdId],
        queryFn: () => getStoresFn(),
      }),
      queryClient.ensureQueryData({
        queryKey: ['household-logs', householdId],
        queryFn: () => getHouseholdLogsFn(),
      }),
    ])
  },
  component: Home,
})

export function Home() {
  const { session } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()

  useEffect(() => {
    if (!session && isStandalone()) {
      void navigate({ to: '/login', search: { ...search, returnTo: '/' }, replace: true })
    }
  }, [session, search, navigate])

  if (!session) {
    return <LandingPage />
  }

  return (
    <main id="main-content" className={`${styles.main} ${styles.mainAuth}`}>
      <div className={styles.dashboardContent}>
        <header className={styles.dashboardHeader}>
          <div className={styles.headerTop}>
            <h2 className={styles.headerTitle}>My List</h2>
          </div>
        </header>

        <div className={styles.addItemWrapper}>
          <AddItemForm />
        </div>
        
        <SmartView
          session={session}
        />
      </div>
    </main>
  )
}
