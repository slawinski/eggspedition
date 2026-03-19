import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { addGroceryItemFn, getCategoriesFn, getStoresFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import { Plus, Tag, Store as StoreIcon, Hash } from 'lucide-react'
import { z } from 'zod'
import type { Category, Store, Session } from '../lib/schemas'

const addItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  quantity: z.string().optional(),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  storeId: z.string().uuid().optional().or(z.literal('')),
})

export default function AddItemForm({ session }: { session: Session | null }) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [categoryId, setCategoryId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [showExtras, setShowExtras] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add milk, eggs, flour..."
            className={styles.input}
            disabled={mutation.isPending}
          />
          <button
            type="button"
            onClick={() => setShowExtras(!showExtras)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)] opacity-40 hover:opacity-100 transition-opacity"
          >
            <Hash className={`h-4 w-4 ${showExtras ? 'text-[#a18cd1]' : ''}`} />
          </button>
        </div>
        <button
          type="submit"
          disabled={mutation.isPending || !name.trim()}
          className={`${styles.button} flex items-center justify-center p-3`}
        >
          <Plus className="h-6 w-6" />
        </button>
      </form>

      {showExtras && (
        <div className={`${styles.card} !p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 !rounded-2xl`}>
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-[var(--sea-ink-soft)]" />
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
              className={`${styles.input} !py-1 text-sm`}
            />
          </div>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-[var(--sea-ink-soft)]" />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`${styles.input} !py-1 text-sm appearance-none`}
            >
              <option value="">Category...</option>
              {categories?.map((c: Category) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <StoreIcon className="h-4 w-4 text-[var(--sea-ink-soft)]" />
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className={`${styles.input} !py-1 text-sm appearance-none`}
            >
              <option value="">Store...</option>
              {stores?.map((s: Store) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      
      {error && <p className="text-xs text-red-400 ml-2">{error}</p>}
    </div>
  )
}
