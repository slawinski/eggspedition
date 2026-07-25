import { useState, useEffect } from 'react'
import { Tag, Store, Plus, Cloud, User, Clock } from 'lucide-react'
import styles from './ProductPreview.module.css'

function useDemoAnimation() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setStep(3)
      return
    }
    const t1 = setTimeout(() => setStep(1), 600)
    const t2 = setTimeout(() => setStep(2), 1400)
    const t3 = setTimeout(() => setStep(3), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return step
}

export default function ProductPreview() {
  const [view, setView] = useState<'category' | 'store'>('category')
  const demoStep = useDemoAnimation()

  const items = [
    { name: 'Bananas', category: 'Produce', store: 'Biedronka', qty: 6 },
    { name: 'Avocados', category: 'Produce', store: 'Biedronka', qty: 2 },
    { name: 'Milk', category: 'Dairy', store: 'Biedronka', qty: 1 },
    { name: 'Yoghurt', category: 'Dairy', store: 'Biedronka', qty: 4 },
    { name: 'Coffee', category: 'Pantry', store: 'Any store', qty: 1, animate: true },
  ]

  const groups = view === 'category'
    ? groupBy(items, i => i.category)
    : groupBy(items, i => i.store)

  return (
    <div className={styles.shell} aria-hidden="true">
      <div className={styles.panel}>
        {/* App header */}
        <div className={styles.appHeader}>
          <span className={styles.appTitle}>Saturday shop</span>
          <span className={styles.appStatus}><Cloud className={styles.statusIcon} /> Synced</span>
        </div>

        {/* Quick Add chips */}
        <div className={styles.quickAddRow}>
          {['Eggs', 'Milk', 'Bananas', 'Coffee'].map((name) => (
            <span key={name} className={`${styles.quickChip} ${name === 'Coffee' && demoStep >= 1 ? styles.quickChipAdded : ''}`}>
              <Plus className={styles.chipIcon} />
              {name}
            </span>
          ))}
        </div>

        {/* Category/Store toggle */}
        <div className={styles.toggleRow}>
          <button
            className={`${styles.toggleBtn} ${view === 'category' ? styles.toggleBtnActive : ''}`}
            onClick={() => setView('category')}
            aria-pressed={view === 'category'}
          >
            <Tag className={styles.toggleIcon} /> Category
          </button>
          <button
            className={`${styles.toggleBtn} ${view === 'store' ? styles.toggleBtnActive : ''}`}
            onClick={() => setView('store')}
            aria-pressed={view === 'store'}
          >
            <Store className={styles.toggleIcon} /> Store
          </button>
        </div>

        {/* Grouped list */}
        {Object.entries(groups).map(([groupName, groupItems]: [string, any[]]) => (
          <div key={groupName} className={styles.groupCard}>
            <h3 className={styles.groupLabel}>
              <span className={styles.groupDot} />
              {groupName}
            </h3>
            {groupItems.map((item) => (
              <div
                key={item.name}
                className={`${styles.listItem} ${item.animate && demoStep >= 2 ? styles.listItemEnter : ''} ${item.animate && demoStep < 2 ? styles.listItemHidden : ''}`}
              >
                <span className={styles.itemCheck}>
                  <span className={styles.checkCircle} />
                </span>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemQty}>× {item.qty}</span>
              </div>
            ))}
          </div>
        ))}

        {/* Activity notification bubble */}
        {(demoStep >= 2) && (
          <div className={styles.activityBubble}>
            <User className={styles.activityIcon} />
            <span className={styles.activityText}><strong>Alex</strong> added Coffee</span>
            <Clock className={styles.activityTime} />
            <span className={styles.activityTimestamp}>12:42</span>
          </div>
        )}

        {/* Store chip floating */}
        <div className={styles.storeChip}>
          <Store className={styles.chipIcon} />
          Biedronka · 5 items
        </div>
      </div>
    </div>
  )
}

function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = fn(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, T[]>)
}
