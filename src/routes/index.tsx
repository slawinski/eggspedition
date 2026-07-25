import { createFileRoute } from '@tanstack/react-router'
import AddItemForm from '../components/AddItemForm'
import QuickAdd from '../components/QuickAdd'
import SmartView from '../components/SmartView'
import ShareHousehold from '../components/ShareHousehold'
import LandingPage from '../components/landing/LandingPage'
import { getGroceryItemsFn, getFrequentItemsFn, getQuickAddItemsFn, getGroceryItemsGroupedFn, getCategoriesFn, getStoresFn, getHouseholdLogsFn } from '../services/grocery.api'
import styles from './index.module.css'

export const Route = createFileRoute('/')({
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
        queryKey: ['frequent-items', householdId],
        queryFn: () => getFrequentItemsFn(),
      }),
      queryClient.ensureQueryData({
        queryKey: ['quick-add-items', householdId],
        queryFn: () => getQuickAddItemsFn(),
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

function Home() {
  const { session } = Route.useRouteContext()

  if (!session) {
    return <LandingPage />
  }

  return (
    <main className={`${styles.main} ${styles.mainAuth}`}>
      <div className={styles.dashboardContent}>
        <header className={styles.dashboardHeader}>
          <div className={styles.headerTop}>
            <h2 className={styles.headerTitle}>My List</h2>
          </div>
          {session.householdId && <ShareHousehold householdId={session.householdId} />}
        </header>

        <div className={styles.addItemWrapper}>
          <AddItemForm />
        </div>
        
        <div className={styles.quickAddWrapper}>
          <QuickAdd />
        </div>
        
        <SmartView session={session} />
      </div>
    </main>
  )
}
