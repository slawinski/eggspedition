import { createFileRoute, redirect } from '@tanstack/react-router'
import QuickAdd from '../components/QuickAdd'
import styles from './index.module.css'

export const Route = createFileRoute('/quick-add')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
  },
  component: QuickAddPage,
})

function QuickAddPage() {
  return (
    <main className={styles.main}>
      <div className={styles.dashboardContent}>
        <header className={styles.dashboardHeader} style={{ display: 'flex' }}>
          <h2 className={styles.headerTitle}>Quick Add</h2>
        </header>
        <div style={{ display: 'block' }}>
          <QuickAdd />
        </div>
      </div>
    </main>
  )
}
