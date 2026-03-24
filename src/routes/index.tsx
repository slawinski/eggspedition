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
import utils from '../styles/utils.module.css'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { session } = Route.useRouteContext()
  const [view, setView] = useState<'list' | 'smart'>('list')
  const [isActivityOpen, setIsActivityOpen] = useState(false)

  if (!session) {
    return (
      <main className={`${utils.pageWrap} ${utils.px4} ${utils.pb14} ${utils.pt10}`}>
        <section className={`island-shell ${utils.relative} ${utils.rounded3xl} ${utils.px6} ${utils.py10} ${utils.smP5}`} style={{ overflow: 'hidden' }}>
          <div className={`${utils.absolute}`} style={{ pointerEvents: 'none', left: '-5rem', top: '-6rem', height: '14rem', width: '14rem', borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,154,158,0.32),transparent 66%)' }} />
          <div className={`${utils.absolute}`} style={{ pointerEvents: 'none', bottom: '-5rem', right: '-5rem', height: '14rem', width: '14rem', borderRadius: '50%', background: 'radial-gradient(circle,rgba(161,140,209,0.18),transparent 66%)' }} />
          <p className={`${utils.islandKicker} ${utils.mb3}`}>Family Shopping Made Simple</p>
          <h1 className={`display-title ${utils.mb4} ${utils.fontBold} ${utils.trackingTight}`} style={{ maxWidth: '48rem', fontSize: 'min(4rem, 12vw)', lineHeight: '1.02', color: 'var(--sea-ink)' }}>
            Squishy. Shared. <br /> Seamless.
          </h1>
          <p className={`${utils.mb4}`} style={{ maxWidth: '40rem', fontSize: '1.125rem', color: 'var(--sea-ink-soft)' }}>
            Eggspedition is the delightful, claymorphic grocery list app for your household.
            Real-time sync, matrix categorization, and a feel-good UI.
          </p>
          <div className={`${utils.flex} ${utils.flexWrap} ${utils.gap3}`}>
            <Link
              to="/login"
              className={`${utils.roundedFull} ${utils.px6} ${utils.py3} ${utils.fontBold} ${utils.transition}`}
              style={{ 
                background: 'linear-gradient(to right, #ff9a9e, #a18cd1)', 
                color: 'white', 
                textDecoration: 'none',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
            >
              Get Started
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={`${utils.pageWrap} ${utils.px4} ${utils.pb14} ${utils.pt6}`}>
      <div className={`${utils.flex} ${utils.flexCol} ${utils.gap6}`}>
        <header className={`${utils.flex} ${utils.flexCol} ${utils.gap2}`}>
          <div className={`${utils.flex} ${utils.itemsCenter} ${utils.justifyBetween}`}>
            <h2 className={`${utils.m0} ${utils.textLg} ${utils.fontBold}`} style={{ color: 'var(--sea-ink)' }}>My List</h2>
            <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.roundedXl} ${utils.p1}`} style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <button
                onClick={() => setView('list')}
                title="List View"
                className={`${utils.p2} ${utils.rounded} ${utils.transition}`}
                style={{ 
                  backgroundColor: view === 'list' ? 'white' : 'transparent', 
                  boxShadow: view === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  color: view === 'list' ? '#ff9a9e' : 'var(--sea-ink-soft)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <List className={`${utils.h5} ${utils.w5}`} />
              </button>
              <button
                onClick={() => setView('smart')}
                title="Smart View"
                className={`${utils.p2} ${utils.rounded} ${utils.transition}`}
                style={{ 
                  backgroundColor: view === 'smart' ? 'white' : 'transparent', 
                  boxShadow: view === 'smart' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  color: view === 'smart' ? '#a18cd1' : 'var(--sea-ink-soft)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Sparkles className={`${utils.h5} ${utils.w5}`} />
              </button>
              <div style={{ width: '1px', height: '1rem', backgroundColor: 'var(--line)', margin: '0 0.25rem' }} />
              <button
                onClick={() => setIsActivityOpen(true)}
                title="Activity Log"
                className={`${utils.p2} ${utils.rounded} ${utils.transition}`}
                style={{ 
                  color: 'var(--sea-ink-soft)', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer'
                }}
              >
                <History className={`${utils.h5} ${utils.w5}`} />
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
