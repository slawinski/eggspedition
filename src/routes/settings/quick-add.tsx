import { createFileRoute, redirect } from '@tanstack/react-router'
import QuickAddTemplateManager from '../../components/AdminDashboard'
import styles from '../index.module.css'

export const Route = createFileRoute('/settings/quick-add')({
  beforeLoad: ({ context }) => {
    if (!context.session?.householdId) {
      throw redirect({ to: '/login' })
    }
  },
  component: QuickAddSettingsPage,
})

function QuickAddSettingsPage() {
  const { session } = Route.useRouteContext()

  return (
    <main id="main-content" className={styles.main}>
      <div className={styles.dashboardContent}>
        <header className={styles.dashboardHeader} style={{ display: 'flex' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
            <h2 className={styles.headerTitle}>Quick Add Templates</h2>
            <p
              style={{
                margin: 0,
                fontSize: '0.8125rem',
                color: 'var(--sea-ink-soft)',
                fontWeight: 500,
                maxWidth: '42ch',
              }}
            >
              Manage the items that appear in your Quick Add bar for faster shopping.
            </p>
          </div>
        </header>
        <QuickAddTemplateManager householdId={session!.householdId!} />
      </div>
    </main>
  )
}
