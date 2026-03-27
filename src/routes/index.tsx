import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import AddItemForm from '../components/AddItemForm'
import QuickAdd from '../components/QuickAdd'
import HouseholdActivityFeed from '../components/HouseholdActivityFeed'
import SmartView from '../components/SmartView'
import ShareHousehold from '../components/ShareHousehold'
import Modal from '../components/Modal'
import AdminDashboard from '../components/AdminDashboard'
import { History, Settings } from 'lucide-react'
import styles from './index.module.css'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { session } = Route.useRouteContext()
  const [isActivityOpen, setIsActivityOpen] = useState(false)
  const [isAdminOpen, setIsAdminOpen] = useState(false)

  if (!session) {
    return (
      <main className={styles.main}>
        <section className={styles.heroSection}>
          <div className={styles.heroGradient1} />
          <div className={styles.heroGradient2} />
          <p className={styles.heroKicker}>Family Shopping Made Simple</p>
          <h1 className={styles.heroTitle}>
            Squishy. Shared. <br /> Seamless.
          </h1>
          <p className={styles.heroDescription}>
            Eggspedition is the delightful, claymorphic grocery list app for your household.
            Real-time sync, matrix categorization, and a feel-good UI.
          </p>
          <div className={styles.heroActions}>
            <Link
              to="/login"
              className={styles.getStartedButton}
            >
              Get Started
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={`${styles.main} ${styles.mainAuth}`}>
      <div className={styles.dashboardContent}>
        <header className={styles.dashboardHeader}>
          <div className={styles.headerTop}>
            <h2 className={styles.headerTitle}>My List</h2>
            <div className={styles.headerActions}>
              <button
                onClick={() => setIsActivityOpen(true)}
                title="Activity Log"
                className={styles.iconButton}
              >
                <History className={styles.toggleIcon} />
              </button>
              <button
                onClick={() => setIsAdminOpen(true)}
                title="Manage Templates"
                className={styles.iconButton}
              >
                <Settings className={styles.toggleIcon} />
              </button>
            </div>
          </div>
          {session.householdId && <ShareHousehold householdId={session.householdId} />}
        </header>

        <AddItemForm />
        
        <QuickAdd />
        
        <SmartView session={session} />
        
        <Modal 
          isOpen={isActivityOpen} 
          onClose={() => setIsActivityOpen(false)} 
          title="Household Activity"
        >
          <HouseholdActivityFeed />
        </Modal>

        <Modal
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          title="Manage Templates"
        >
          <AdminDashboard householdId={session.householdId} />
        </Modal>
      </div>
    </main>
  )
}
