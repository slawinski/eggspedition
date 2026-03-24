import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getQuickAddItemsFn, addQuickAddItemFn, updateQuickAddItemFn, deleteQuickAddItemFn, getCategoriesFn, getStoresFn } from '../services/grocery.api'
import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, Settings, Zap } from 'lucide-react'
import Signals from '../components/Signals'
import utils from '../styles/utils.module.css'

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
  },
  component: AdminPage,
})

function AdminPage() {
  const { session } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [storeName, setStoreName] = useState('')

  const { data: items = [], isLoading: isLoadingItems, isError: isErrorItems } = useQuery({
    queryKey: ['quick-add-items', session?.householdId],
    queryFn: () => getQuickAddItemsFn(),
    enabled: !!session?.householdId,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', session?.householdId],
    queryFn: () => getCategoriesFn(),
    enabled: !!session?.householdId,
  })

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', session?.householdId],
    queryFn: () => getStoresFn(),
    enabled: !!session?.householdId,
  })

  const addMutation = useMutation({
    mutationFn: (vars: { name: string; categoryName: string; storeName: string }) =>
      addQuickAddItemFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      setIsAdding(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; data: { name: string; categoryName: string; storeName: string } }) =>
      updateQuickAddItemFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      setEditingId(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuickAddItemFn({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })
    },
  })

  const resetForm = () => {
    setName('')
    setCategoryName('')
    setStoreName('')
  }

  const handleEdit = (item: any) => {
    setEditingId(item.id)
    setName(item.name)
    const cat = categories.find(c => c.id === item.categoryId)
    const str = stores.find(s => s.id === item.storeId)
    setCategoryName(cat ? cat.name : '')
    setStoreName(str ? str.name : '')
    setIsAdding(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: { name, categoryName, storeName },
      })
    } else {
      addMutation.mutate({ name, categoryName, storeName })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      if (name && !addMutation.isPending && !updateMutation.isPending) {
        handleSave()
      }
    }
  }

  const isPending = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const error = addMutation.error || updateMutation.error || deleteMutation.error

  return (
    <main className={`${utils.pb14} ${utils.pt10}`} style={{ minHeight: '100vh', backgroundColor: 'var(--page-bg)' }}>
      <Signals />
      <div className={`${utils.pageWrap} ${utils.px4}`}>
        <header className={`${utils.mb4} ${utils.flex} ${utils.itemsCenter} ${utils.justifyBetween}`}>
          <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap3}`}>
            <div className={`${utils.flex} ${utils.itemsCenter} ${utils.justifyCenter} ${utils.rounded2xl} ${utils.shadowChip}`} style={{ width: '3rem', height: '3rem', backgroundColor: 'white' }}>
              <Settings className={`${utils.h6} ${utils.w6}`} style={{ color: '#a18cd1' }} />
            </div>
            <div>
              <h2 className={`${utils.m0} ${utils.textLg} ${utils.fontBold} ${utils.trackingTight}`} style={{ color: 'var(--sea-ink)' }}>Admin Dashboard</h2>
              <p className={`${utils.m0} ${utils.textSm} ${utils.fontMedium}`} style={{ color: 'var(--sea-ink-soft)' }}>Manage templates</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsAdding(true)
              setEditingId(null)
              resetForm()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.roundedXl} ${utils.px4} ${utils.py2_5} ${utils.textSm} ${utils.fontBold} ${utils.shadowChip} ${utils.transition} ${utils.activeScale95}`}
            style={{ backgroundColor: 'white', color: '#ff9a9e', border: 'none', cursor: 'pointer' }}
          >
            <Plus className={utils.icon} />
            Add Template
          </button>
        </header>

        {(isAdding || editingId) && (
          <div className={`${utils.mb4} ${utils.rounded3xl} ${utils.p6} ${utils.shadowChip} ${utils.animateIn}`} style={{ backgroundColor: 'white', border: '1px solid var(--line)' }}>
            <h3 className={`${utils.mb4} ${utils.textLg} ${utils.fontBold} ${utils.flex} ${utils.itemsCenter} ${utils.gap2}`} style={{ color: 'var(--sea-ink)' }}>
              {editingId ? <Edit2 className={utils.icon} style={{ color: '#a18cd1' }} /> : <Plus className={utils.icon} style={{ color: '#ff9a9e' }} />}
              {editingId ? 'Edit Template' : 'Add New Template'}
            </h3>
            <div className={`${utils.grid} ${utils.gap4} ${utils.smGridCols3}`}>
              <div className={`${utils.flex} ${utils.flexCol} ${utils.gap1}`}>
                <label className={`${utils.textXs} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider} ${utils.px1}`} style={{ color: 'var(--sea-ink-soft)' }}>Item Name</label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Oat Milk"
                  className={`${utils.wFull} ${utils.rounded2xl} ${utils.px4} ${utils.py3} ${utils.textSm} ${utils.fontMedium} ${utils.outlineNone}`}
                  style={{ border: '1px solid var(--line)', backgroundColor: 'var(--bg-base)' }}
                />
              </div>
              <div className={`${utils.flex} ${utils.flexCol} ${utils.gap1}`}>
                <label className={`${utils.textXs} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider} ${utils.px1}`} style={{ color: 'var(--sea-ink-soft)' }}>Category</label>
                <input
                  type="text"
                  list="category-list"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Dairy"
                  className={`${utils.wFull} ${utils.rounded2xl} ${utils.px4} ${utils.py3} ${utils.textSm} ${utils.fontMedium} ${utils.outlineNone}`}
                  style={{ border: '1px solid var(--line)', backgroundColor: 'var(--bg-base)' }}
                />
                <datalist id="category-list">
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
              <div className={`${utils.flex} ${utils.flexCol} ${utils.gap1}`}>
                <label className={`${utils.textXs} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider} ${utils.px1}`} style={{ color: 'var(--sea-ink-soft)' }}>Preferred Store</label>
                <input
                  type="text"
                  list="store-list"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Trader Joe's"
                  className={`${utils.wFull} ${utils.rounded2xl} ${utils.px4} ${utils.py3} ${utils.textSm} ${utils.fontMedium} ${utils.outlineNone}`}
                  style={{ border: '1px solid var(--line)', backgroundColor: 'var(--bg-base)' }}
                />
                <datalist id="store-list">
                  {stores.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className={`${utils.mt3} ${utils.flex} ${utils.flexCol} ${utils.gap3}`}>
              {error && (
                <p className={`${utils.roundedXl} ${utils.p3} ${utils.textXs} ${utils.fontMedium} ${utils.animateIn}`} style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2' }}>
                  {error instanceof Error ? error.message : 'Something went wrong.'}
                </p>
              )}
              <div className={`${utils.flex} ${utils.justifyEnd} ${utils.gap3}`}>
                <button
                  onClick={() => {
                    setIsAdding(false)
                    setEditingId(null)
                  }}
                  disabled={isPending}
                  className={`${utils.roundedXl} ${utils.px4} ${utils.py2} ${utils.textSm} ${utils.fontBold} ${utils.transition}`}
                  style={{ border: '1px solid var(--line)', color: 'var(--sea-ink-soft)', background: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!name || isPending}
                  className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.roundedXl} ${utils.px6} ${utils.py2} ${utils.textSm} ${utils.fontBold} ${utils.transition} ${utils.activeScale95}`}
                  style={{ 
                    background: 'linear-gradient(to right, #ff9a9e, #fecfef)', 
                    color: 'white', 
                    border: 'none', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  {isPending ? (
                    <div className={`${utils.animateSpin}`} style={{ height: '1rem', width: '1rem', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                  ) : (
                    <Check className={utils.icon} />
                  )}
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`${utils.grid} ${utils.gap4} ${utils.smGridCols3}`} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {isLoadingItems ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`${utils.rounded3xl} ${utils.animateSpin}`} style={{ height: '6rem', backgroundColor: 'white', border: '1px solid var(--line)', opacity: 0.1 }} />
            ))
          ) : isErrorItems ? (
            <div className={`${utils.textCenter} ${utils.py12} ${utils.fontMedium}`} style={{ gridColumn: '1 / -1', color: '#f87171' }}>
              Failed to load templates.
            </div>
          ) : (
            items.map((item) => {
              const category = categories.find((c) => c.id === item.categoryId)
              const store = stores.find((s) => s.id === item.storeId)
              const isEditingThis = editingId === item.id
              
              return (
                <div
                  key={item.id}
                  className={`${utils.relative} ${utils.rounded3xl} ${utils.shadowChip} ${utils.transition}`}
                  style={{ 
                    backgroundColor: isEditingThis ? 'rgba(161, 140, 209, 0.05)' : 'white', 
                    border: isEditingThis ? '1px solid rgba(161, 140, 209, 0.3)' : '1px solid transparent',
                    overflow: 'hidden'
                  }}
                >
                  <div className={`${utils.flex} ${utils.flexCol} ${utils.p4}`}>
                    <div 
                      onClick={() => handleEdit(item)}
                      style={{ cursor: 'pointer', flex: 1 }}
                    >
                      <h4 className={`${utils.m0} ${utils.textSm} ${utils.fontBold}`} style={{ color: isEditingThis ? '#a18cd1' : 'var(--sea-ink)' }}>{item.name}</h4>
                      <div className={`${utils.mt3} ${utils.flex} ${utils.flexWrap} ${utils.gap2}`}>
                        {category ? (
                          <span className={`${utils.roundedFull} ${utils.px2} ${utils.py0_5} ${utils.text10px} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider}`} style={{ backgroundColor: 'var(--bg-base)', color: 'var(--sea-ink-soft)', border: '1px solid var(--line)' }}>
                            {category.name}
                          </span>
                        ) : (
                          <span className={`${utils.roundedFull} ${utils.px2} ${utils.py0_5} ${utils.text10px} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider}`} style={{ backgroundColor: 'var(--bg-base)', color: '#9ca3af', border: '1px dashed var(--line)' }}>
                            No Category
                          </span>
                        )}
                        {store ? (
                          <span className={`${utils.roundedFull} ${utils.px2} ${utils.py0_5} ${utils.text10px} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider}`} style={{ backgroundColor: 'rgba(254, 207, 239, 0.3)', color: '#ff9a9e', border: '1px solid rgba(255, 154, 158, 0.2)' }}>
                            {store.name}
                          </span>
                        ) : (
                          <span className={`${utils.roundedFull} ${utils.px2} ${utils.py0_5} ${utils.text10px} ${utils.fontBold} ${utils.uppercase} ${utils.trackingWider}`} style={{ backgroundColor: 'var(--bg-base)', color: '#9ca3af', border: '1px dashed var(--line)' }}>
                            Any Store
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`${utils.flex} ${utils.justifyEnd} ${utils.gap1} ${utils.mt3}`}>
                      <button
                        onClick={() => handleEdit(item)}
                        className={`${utils.p1} ${utils.rounded}`}
                        style={{ color: isEditingThis ? '#a18cd1' : '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                        title="Edit Template"
                      >
                        <Edit2 className={utils.iconSm} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${item.name}" template?`)) {
                            deleteMutation.mutate(item.id)
                          }
                        }}
                        className={`${utils.p1} ${utils.rounded}`}
                        style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                        title="Delete Template"
                      >
                        <Trash2 className={utils.iconSm} />
                      </button>
                    </div>
                  </div>
                  <div className={`${utils.absolute}`} style={{ right: '-10px', bottom: '-10px', transform: 'rotate(-15deg)', opacity: 0.03, pointerEvents: 'none' }}>
                    <Zap style={{ width: '5rem', height: '5rem', color: '#a18cd1' }} />
                  </div>
                </div>
              )
            })
          )}
          
          {items.length === 0 && !isAdding && !isLoadingItems && !isErrorItems && (
            <div className={`${utils.flex} ${utils.flexCol} ${utils.itemsCenter} ${utils.justifyCenter} ${utils.py12} ${utils.textCenter}`} style={{ gridColumn: '1 / -1', borderRadius: '3rem', border: '2px dashed var(--line)' }}>
              <div className={`${utils.mb4} ${utils.flex} ${utils.itemsCenter} ${utils.justifyCenter} ${utils.rounded2xl} ${utils.shadowChip}`} style={{ width: '4rem', height: '4rem', backgroundColor: 'white' }}>
                <Zap className={`${utils.h8} ${utils.w8}`} style={{ color: '#d1d5db' }} />
              </div>
              <h3 className={`${utils.textLg} ${utils.fontBold}`} style={{ color: 'var(--sea-ink)' }}>No templates yet</h3>
              <p className={`${utils.textSm} ${utils.fontMedium}`} style={{ color: 'var(--sea-ink-soft)', maxWidth: '20rem' }}>
                Create templates to quickly add items.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
