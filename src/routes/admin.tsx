import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getQuickAddItemsFn, addQuickAddItemFn, updateQuickAddItemFn, deleteQuickAddItemFn, getCategoriesFn, getStoresFn } from '../services/grocery.api'
import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, Settings, Zap } from 'lucide-react'
import Signals from '../components/Signals'
import styles from './admin.module.css'

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
    <main className={styles.container}>
      <Signals />
      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.iconWrapper}>
              <Settings className={styles.headerIcon} />
            </div>
            <div>
              <h2 className={styles.dashboardTitle}>Admin Dashboard</h2>
              <p className={styles.dashboardSubtitle}>Manage templates</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsAdding(true)
              setEditingId(null)
              resetForm()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className={styles.addBtn}
          >
            <Plus className={styles.btnIcon} />
            Add Template
          </button>
        </header>

        {(isAdding || editingId) && (
          <div className={styles.formCard}>
            <h3 className={styles.formTitle}>
              {editingId ? <Edit2 className={styles.formTitleIconEdit} /> : <Plus className={styles.formTitleIconAdd} />}
              {editingId ? 'Edit Template' : 'Add New Template'}
            </h3>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.inputLabel}>Item Name</label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Oat Milk"
                  className={styles.input}
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.inputLabel}>Category</label>
                <input
                  type="text"
                  list="category-list"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Dairy"
                  className={styles.input}
                />
                <datalist id="category-list">
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
              <div className={styles.formField}>
                <label className={styles.inputLabel}>Preferred Store</label>
                <input
                  type="text"
                  list="store-list"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Trader Joe's"
                  className={styles.input}
                />
                <datalist id="store-list">
                  {stores.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className={styles.formActions}>
              {error && (
                <p className={styles.formError}>
                  {error instanceof Error ? error.message : 'Something went wrong.'}
                </p>
              )}
              <div className={styles.actionButtons}>
                <button
                  onClick={() => {
                    setIsAdding(false)
                    setEditingId(null)
                  }}
                  disabled={isPending}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!name || isPending}
                  className={styles.saveBtn}
                >
                  {isPending ? (
                    <div className={styles.loadingSpinner} />
                  ) : (
                    <Check className={styles.btnIcon} />
                  )}
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.grid}>
          {isLoadingItems ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard} />
            ))
          ) : isErrorItems ? (
            <div className={styles.errorState}>
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
                  className={styles.itemCard}
                  style={{ 
                    backgroundColor: isEditingThis ? 'rgba(161, 140, 209, 0.05)' : 'white', 
                    border: isEditingThis ? '1px solid rgba(161, 140, 209, 0.3)' : '1px solid transparent',
                  }}
                >
                  <div className={styles.itemInfo}>
                    <div 
                      onClick={() => handleEdit(item)}
                      style={{ cursor: 'pointer', flex: 1 }}
                    >
                      <h4 className={styles.itemName} style={{ color: isEditingThis ? '#a18cd1' : 'var(--sea-ink)' }}>{item.name}</h4>
                      <div className={styles.tagList}>
                        {category ? (
                          <span className={styles.tag}>
                            {category.name}
                          </span>
                        ) : (
                          <span className={styles.noTag}>
                            No Category
                          </span>
                        )}
                        {store ? (
                          <span className={styles.storeTag}>
                            {store.name}
                          </span>
                        ) : (
                          <span className={styles.noTag}>
                            Any Store
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        onClick={() => handleEdit(item)}
                        className={styles.actionBtn}
                        style={{ color: isEditingThis ? '#a18cd1' : '#9ca3af' }}
                        title="Edit Template"
                      >
                        <Edit2 className={styles.actionIcon} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${item.name}" template?`)) {
                            deleteMutation.mutate(item.id)
                          }
                        }}
                        className={styles.actionBtn}
                        title="Delete Template"
                      >
                        <Trash2 className={styles.actionIcon} />
                      </button>
                    </div>
                  </div>
                  <div className={styles.backgroundIcon}>
                    <Zap className={styles.bgIcon} />
                  </div>
                </div>
              )
            })
          )}
          
          {items.length === 0 && !isAdding && !isLoadingItems && !isErrorItems && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrapper}>
                <Zap className={styles.emptyIcon} />
              </div>
              <h3 className={styles.emptyTitle}>No templates yet</h3>
              <p className={styles.emptySubtitle}>
                Create templates to quickly add items.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
