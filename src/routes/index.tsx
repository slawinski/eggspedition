import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import GroceryList from '../components/GroceryList'
import AddItemForm from '../components/AddItemForm'
import QuickAdd from '../components/QuickAdd'
import HouseholdActivityFeed from '../components/HouseholdActivityFeed'
import SmartView from '../components/SmartView'
import ShareHousehold from '../components/ShareHousehold'
import Modal from '../components/Modal'
import { List, Sparkles, History } from 'lucide-react'
import styles from './index.module.css'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { session } = Route.useRouteContext()
  const [view, setView] = useState<'list' | 'smart'>('list')
  const [isActivityOpen, setIsActivityOpen] = useState(false)

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
            <div className={styles.viewToggle}>
              <button
                onClick={() => setView('list')}
                title="List View"
                className={`${styles.toggleButton} ${view === 'list' ? styles.toggleButtonActiveList : ''}`}
              >
                <List className={styles.toggleIcon} />
              </button>
              <button
                onClick={() => setView('smart')}
                title="Smart View"
                className={`${styles.toggleButton} ${view === 'smart' ? styles.toggleButtonActiveSmart : ''}`}
              >
                <Sparkles className={styles.toggleIcon} />
              </button>
              <div className={styles.divider} />
              <button
                onClick={() => setIsActivityOpen(true)}
                title="Activity Log"
                className={styles.activityButton}
              >
                <History className={styles.toggleIcon} />
              </button>
            </div>
          </div>
          {session.householdId && <ShareHousehold householdId={session.householdId} />}
        </header>

        <AddItemForm />
        
        <QuickAdd />
        
        {view === 'list' ? <GroceryList session={session} /> : <SmartView session={session} />}
        
        <Modal 
          isOpen={isActivityOpen} 
          onClose={() => setIsActivityOpen(false)} 
          title="Household Activity"
        >
          <HouseholdActivityFeed />
        </Modal>
      </div>
    </main>
  )
}
