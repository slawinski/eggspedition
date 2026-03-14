import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import GroceryList from '../components/GroceryList'
import AddItemForm from '../components/AddItemForm'
import HouseholdActivityFeed from '../components/HouseholdActivityFeed'
import MatrixView from '../components/MatrixView'
import { List, LayoutGrid } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const { session } = Route.useRouteContext()
  const [view, setView] = useState<'list' | 'matrix'>('list')

  if (!session) {
    return (
      <main className="page-wrap px-4 pb-8 pt-14">
        <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
          <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,154,158,0.32),transparent_66%)]" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(161,140,209,0.18),transparent_66%)]" />
          <p className="island-kicker mb-3">Family Shopping Made Simple</p>
          <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
            Squishy. Shared. <br /> Seamless.
          </h1>
          <p className="mb-8 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg">
            Eggspedition is the delightful, claymorphic grocery list app for your household.
            Real-time sync, matrix categorization, and a feel-good UI.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/login"
              className="rounded-full bg-gradient-to-r from-[#ff9a9e] to-[#a18cd1] px-6 py-3 text-white font-bold shadow-lg transition hover:scale-105 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-6">
      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--sea-ink)]">My List</h2>
          <div className="flex items-center gap-2 rounded-xl bg-[rgba(0,0,0,0.05)] p-1">
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white shadow-sm text-[#ff9a9e]' : 'text-[var(--sea-ink-soft)]'}`}
            >
              <List className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('matrix')}
              className={`p-2 rounded-lg transition-all ${view === 'matrix' ? 'bg-white shadow-sm text-[#a18cd1]' : 'text-[var(--sea-ink-soft)]'}`}
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
          </div>
        </header>

        <AddItemForm />
        
        {view === 'list' ? <GroceryList /> : <MatrixView />}
        
        <HouseholdActivityFeed />
      </div>
    </main>
  )
}
