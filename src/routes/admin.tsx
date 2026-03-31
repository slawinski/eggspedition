import { createFileRoute, redirect } from '@tanstack/react-router'
import AdminDashboard from '../components/AdminDashboard'
import styles from './index.module.css'

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ context }) => {
    if (!context.session?.householdId) {
      throw redirect({ to: '/login' })
    }
  },
  component: AdminPage,
})

function AdminPage() {
  const { session } = Route.useRouteContext()

  return (
    <main className={styles.main}>
      <div className={styles.dashboardContent}>
        <header className={styles.dashboardHeader} style={{ display: 'flex' }}>
          <h2 className={styles.headerTitle}>Manage Templates</h2>
        </header>
        <AdminDashboard householdId={session!.householdId!} />
      </div>
    </main>
  )
}
