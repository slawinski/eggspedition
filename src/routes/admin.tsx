import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getQuickAddItemsFn, addQuickAddItemFn, updateQuickAddItemFn, deleteQuickAddItemFn, getCategoriesFn, getStoresFn } from '../services/grocery.api'
import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, Settings, Zap } from 'lucide-react'
import Signals from '../components/Signals'

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
    <main className="min-h-screen bg-[var(--page-bg)] pb-20 pt-6">
      <Signals />
      <div className="page-wrap px-4">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-clay-sm">
              <Settings className="h-6 w-6 text-[#a18cd1]" />
            </div>
            <div>
              <h2 className="m-0 text-2xl font-bold tracking-tight text-[var(--sea-ink)]">Admin Dashboard</h2>
              <p className="m-0 text-sm font-medium text-[var(--sea-ink-soft)]">Manage your household's Quick Add items</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsAdding(true)
              setEditingId(null)
              resetForm()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#ff9a9e] shadow-clay-sm hover:shadow-clay-md transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add Template
          </button>
        </header>

        {(isAdding || editingId) && (
          <div id="template-form" className="mb-8 rounded-3xl bg-white p-6 shadow-clay-md border border-[var(--line)] animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="mb-4 text-lg font-bold text-[var(--sea-ink)] flex items-center gap-2">
              {editingId ? <Edit2 className="h-5 w-5 text-[#a18cd1]" /> : <Plus className="h-5 w-5 text-[#ff9a9e]" />}
              {editingId ? 'Edit Template' : 'Add New Template'}
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--sea-ink-soft)] px-1">Item Name</label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Oat Milk"
                  className="w-full rounded-2xl border border-[var(--line)] bg-[var(--page-bg)] px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#a18cd1]/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--sea-ink-soft)] px-1">Category</label>
                <input
                  type="text"
                  list="category-list"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Dairy"
                  className="w-full rounded-2xl border border-[var(--line)] bg-[var(--page-bg)] px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#a18cd1]/20"
                />
                <datalist id="category-list">
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--sea-ink-soft)] px-1">Preferred Store</label>
                <input
                  type="text"
                  list="store-list"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Trader Joe's"
                  className="w-full rounded-2xl border border-[var(--line)] bg-[var(--page-bg)] px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#a18cd1]/20"
                />
                <datalist id="store-list">
                  {stores.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-500 border border-red-100 animate-in fade-in duration-300">
                  {error instanceof Error ? error.message : 'Something went wrong. Please try again.'}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsAdding(false)
                    setEditingId(null)
                  }}
                  disabled={isPending}
                  className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--sea-ink-soft)] hover:bg-[var(--page-bg)] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!name || isPending}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#ff9a9e] to-[#fecfef] px-6 py-2 text-sm font-bold text-white shadow-clay-sm hover:shadow-clay-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isPending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoadingItems ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-white shadow-clay-sm border border-[var(--line)]/10" />
            ))
          ) : isErrorItems ? (
            <div className="col-span-full py-12 text-center text-red-400 font-medium">
              Failed to load Quick Add items. Please refresh.
            </div>
          ) : (
            items.map((item) => {
              const category = categories.find((c) => c.id === item.categoryId)
              const store = stores.find((s) => s.id === item.storeId)
              const isEditingThis = editingId === item.id
              
              return (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-3xl shadow-clay-sm transition-all hover:shadow-clay-md border ${isEditingThis ? 'bg-[#a18cd1]/5 border-[#a18cd1]/30 ring-2 ring-[#a18cd1]/10' : 'bg-white border-transparent hover:border-[var(--line)]'}`}
                >
                  <div className="flex items-start justify-between p-5">
                    <div 
                      onClick={() => handleEdit(item)}
                      className="flex-1 cursor-pointer"
                    >
                      <h4 className={`m-0 text-base font-bold ${isEditingThis ? 'text-[#a18cd1]' : 'text-[var(--sea-ink)]'}`}>{item.name}</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {category ? (
                          <span className="rounded-full bg-[var(--page-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sea-ink-soft)] border border-[var(--line)]">
                            {category.name}
                          </span>
                        ) : (
                          <span className="rounded-full bg-[var(--page-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-dashed border-[var(--line)]">
                            No Category
                          </span>
                        )}
                        {store ? (
                          <span className="rounded-full bg-[#fecfef]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff9a9e] border border-[#ff9a9e]/20">
                            {store.name}
                          </span>
                        ) : (
                          <span className="rounded-full bg-[var(--page-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-dashed border-[var(--line)]">
                            Any Store
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 relative z-20">
                      <button
                        onClick={() => handleEdit(item)}
                        className={`p-2 rounded-lg transition-colors ${isEditingThis ? 'text-[#a18cd1] bg-[#a18cd1]/10' : 'text-gray-400 hover:text-[#a18cd1] hover:bg-[#a18cd1]/10'}`}
                        title="Edit Template"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${item.name}" template?`)) {
                            deleteMutation.mutate(item.id)
                          }
                        }}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className={`absolute right-[-10px] bottom-[-10px] rotate-[-15deg] opacity-[0.03] transition-all pointer-events-none ${isEditingThis ? 'opacity-[0.1] scale-110' : 'group-hover:opacity-[0.07]'}`}>
                    <Zap className="h-20 w-20 text-[#a18cd1]" />
                  </div>
                </div>
              )
            })
          )}
          
          {items.length === 0 && !isAdding && !isLoadingItems && !isErrorItems && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-[var(--line)] py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-clay-sm">
                <Zap className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-[var(--sea-ink)]">No Quick Add templates yet</h3>
              <p className="max-w-xs text-sm font-medium text-[var(--sea-ink-soft)]">
                Create templates to quickly add items with pre-set categories and stores.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
