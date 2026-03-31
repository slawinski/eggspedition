import { createFileRoute, redirect } from '@tanstack/react-router'
import HouseholdActivityFeed from '../components/HouseholdActivityFeed'
import styles from './index.module.css'

export const Route = createFileRoute('/activity')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
  },
  component: ActivityPage,
})

function ActivityPage() {
  return (
    <main className={styles.main}>
      <div className={styles.dashboardContent}>
        <header className={styles.dashboardHeader} style={{ display: 'flex' }}>
          <h2 className={styles.headerTitle}>Household Activity</h2>
        </header>
        <HouseholdActivityFeed />
      </div>
    </main>
  )
}
