import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import AddItemForm from '../components/AddItemForm'
import styles from './index.module.css'

export const Route = createFileRoute('/add')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
  },
  component: AddPage,
})

function AddPage() {
  const navigate = useNavigate()

  return (
    <main className={styles.main}>
      <div className={styles.dashboardContent} style={{ justifyContent: 'center', minHeight: '60vh' }}>
        <header className={styles.dashboardHeader} style={{ display: 'flex' }}>
          <h2 className={styles.headerTitle}>Add New Item</h2>
        </header>
        <div style={{ display: 'block' }}>
          <AddItemForm onSuccess={() => navigate({ to: '/' })} />
        </div>
      </div>
    </main>
  )
}
