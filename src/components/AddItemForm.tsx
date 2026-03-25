import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { addGroceryItemFn, getCategoriesFn, getStoresFn } from '../services/grocery.api'
import styles from './AddItemForm.module.css'
import { Plus, Tag, Store as StoreIcon, Hash } from 'lucide-react'
import { z } from 'zod'
import type { Category, Store } from '../lib/schemas'
import Modal from './Modal'
import ManageTags from './ManageTags'

const addItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  quantity: z.string().optional(),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  storeId: z.string().uuid().optional().or(z.literal('')),
})

export default function AddItemForm() {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [categoryId, setCategoryId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [showExtras, setShowExtras] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [managingType, setManagingType] = useState<'category' | 'store' | null>(null)

  const queryClient = useQueryClient()

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategoriesFn(),
  })

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStoresFn(),
  })

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof addItemSchema>) => 
      addGroceryItemFn({ 
        data: {
          ...data,
          categoryId: data.categoryId || undefined,
          storeId: data.storeId || undefined,
        } 
      }),
    onSuccess: () => {
      console.log('[AddItemForm] Item added successfully, invalidating...')
      setName('')
      setQuantity('1')
      setCategoryId('')
      setStoreId('')
      setShowExtras(false)
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
      queryClient.invalidateQueries({ queryKey: ['household-logs'] })
      queryClient.invalidateQueries({ queryKey: ['frequent-items'] })
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to add item')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const result = addItemSchema.safeParse({ name, quantity, categoryId, storeId })
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }

    mutation.mutate(result.data)
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.mainForm}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add milk, eggs, flour..."
            className={styles.textInput}
            disabled={mutation.isPending}
          />
          <button
            type="button"
            onClick={() => setShowExtras(!showExtras)}
            className={styles.extrasToggle}
          >
            <Hash className={`${styles.extraFieldIcon} ${showExtras ? styles.activeHashIcon : ''}`} />
          </button>
        </div>
        <button
          type="submit"
          disabled={mutation.isPending || !name.trim()}
          className={styles.submitButton}
        >
          <Plus className={styles.iconLg} />
        </button>
      </form>

      {showExtras && (
        <div className={styles.extrasPanel}>
          <div className={styles.extraField}>
            <Hash className={styles.extraFieldIcon} />
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
              className={styles.extraInput}
            />
          </div>
          <div className={styles.extraField}>
            <Tag className={styles.extraFieldIcon} />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={styles.selectField}
            >
              <option value="">Category...</option>
              {categories?.map((c: Category) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setManagingType('category')}
              className={styles.addTagButton}
              title="Add Category"
            >
              <Plus className={styles.iconXs} />
            </button>
          </div>
          <div className={styles.extraField}>
            <StoreIcon className={styles.extraFieldIcon} />
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className={styles.selectField}
            >
              <option value="">Store...</option>
              {stores?.map((s: Store) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setManagingType('store')}
              className={styles.addTagButton}
              title="Add Store"
            >
              <Plus className={styles.iconXs} />
            </button>
          </div>
        </div>
      )}
      
      {error && <p className={styles.errorMessage}>{error}</p>}

      <Modal 
        isOpen={!!managingType} 
        onClose={() => setManagingType(null)} 
        title={`Manage ${managingType === 'category' ? 'Categories' : 'Stores'}`}
      >
        {managingType && (
          <ManageTags 
            type={managingType} 
            tags={managingType === 'category' ? (categories || []) : (stores || [])} 
            onClose={() => setManagingType(null)}
          />
        )}
      </Modal>
    </div>
  )
}
