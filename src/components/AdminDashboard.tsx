import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Edit2, Check, X, Tag, Store } from 'lucide-react'
import { getQuickAddItemsFn, updateQuickAddItemFn, deleteQuickAddItemFn, getCategoriesFn, getStoresFn } from '../services/grocery.api'
import styles from './AdminDashboard.module.css'

interface AdminDashboardProps {
  householdId?: string
}

export default function AdminDashboard({ householdId }: AdminDashboardProps) {
  const queryClient = useQueryClient()

  const { data: items = [], isLoading: isLoadingItems, isError: isErrorItems } = useQuery({
    queryKey: ['quick-add-items', householdId],
    queryFn: () => getQuickAddItemsFn(),
    enabled: !!householdId,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', householdId],
    queryFn: () => getCategoriesFn(),
    enabled: !!householdId,
  })

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', householdId],
    queryFn: () => getStoresFn(),
    enabled: !!householdId,
  })

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name))
  }, [items])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuickAddItemFn({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })
    },
  })

  return (
    <div className={styles.container}>
      <div className={styles.itemList}>
        {isLoadingItems ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))
        ) : isErrorItems ? (
          <div className={styles.errorState}>
            Failed to load templates.
          </div>
        ) : sortedItems.length === 0 ? (
          <div className={styles.emptyState}>
            No templates found. Templates are created automatically.
          </div>
        ) : (
          sortedItems.map((item) => (
            <TemplateRow 
              key={item.id} 
              item={item} 
              categories={categories} 
              stores={stores}
              onDelete={() => {
                if (confirm(`Delete "${item.name}" template?`)) {
                  deleteMutation.mutate(item.id)
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TemplateRow({ item, categories, stores, onDelete }: { 
  item: any; 
  categories: any[]; 
  stores: any[];
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <TemplateRowEdit 
        item={item} 
        categories={categories} 
        stores={stores} 
        onCancel={() => setIsEditing(false)} 
      />
    )
  }

  return (
    <TemplateRowView 
      item={item} 
      categories={categories} 
      stores={stores} 
      onEdit={() => setIsEditing(true)} 
      onDelete={onDelete} 
    />
  )
}

function TemplateRowView({ item, categories, stores, onEdit, onDelete }: any) {
  const currentCategory = categories.find((c: any) => c.id === item.categoryId)
  const currentStore = stores.find((s: any) => s.id === item.storeId)

  return (
    <div className={styles.itemRow}>
      <div className={styles.itemMain}>
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{item.name}</span>
          <div className={styles.itemTags}>
            {currentCategory && (
              <span className={`${styles.tag} ${styles.tagCategory}`}>
                <Tag className={styles.subInfoIcon} />
                {currentCategory.name}
              </span>
            )}
            {currentStore && (
              <span className={`${styles.tag} ${styles.tagStore}`}>
                <Store className={styles.subInfoIcon} />
                {currentStore.name}
              </span>
            )}
            {!currentCategory && !currentStore && (
              <span className={styles.noTags}>No metadata</span>
            )}
          </div>
        </div>
      </div>
      <div className={styles.itemActions}>
        <button onClick={onEdit} className={styles.actionBtn} title="Edit">
          <Edit2 className={styles.actionIcon} />
        </button>
        <button onClick={onDelete} className={styles.deleteBtn} title="Delete">
          <Trash2 className={styles.actionIcon} />
        </button>
      </div>
    </div>
  )
}

function TemplateRowEdit({ item, categories, stores, onCancel }: any) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(item.name)
  const [categoryName, setCategoryName] = useState(categories.find((c: any) => c.id === item.categoryId)?.name || '')
  const [storeName, setStoreName] = useState(stores.find((s: any) => s.id === item.storeId)?.name || '')

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; data: { name: string; categoryName: string; storeName: string } }) =>
      updateQuickAddItemFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      onCancel()
    },
  })

  const handleSave = () => {
    updateMutation.mutate({
      id: item.id,
      data: { name, categoryName, storeName },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name) handleSave()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className={`${styles.itemRow} ${styles.itemRowEditing}`}>
      <div className={styles.itemMain}>
        <div className={styles.itemInfo}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.editNameInput}
            placeholder="Item name"
            autoFocus
          />
          <div className={styles.itemTags}>
            <div className={styles.tagEditWrapper}>
              <Tag className={styles.subInfoIcon} />
              <input
                type="text"
                list="category-list"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={handleKeyDown}
                className={styles.tagInput}
                placeholder="Category"
              />
            </div>
            <div className={styles.tagEditWrapper}>
              <Store className={styles.subInfoIcon} />
              <input
                type="text"
                list="store-list"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                onKeyDown={handleKeyDown}
                className={styles.tagInput}
                placeholder="Store"
              />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.itemActions}>
        <button 
          onClick={handleSave} 
          className={styles.saveBtn}
          disabled={updateMutation.isPending || !name}
        >
          {updateMutation.isPending ? <div className={styles.spinner} /> : <Check className={styles.actionIcon} />}
        </button>
        <button onClick={onCancel} className={styles.cancelBtn}>
          <X className={styles.actionIcon} />
        </button>
      </div>
      
      <datalist id="category-list">
        {categories.map((c: any) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <datalist id="store-list">
        {stores.map((s: any) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
    </div>
  )
}
