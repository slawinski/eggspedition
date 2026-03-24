import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { addGroceryItemFn, getCategoriesFn, getStoresFn } from '../services/grocery.api'
import clay from '../styles/clay.module.css'
import utils from '../styles/utils.module.css'
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
    <div className={`${utils.flex} ${utils.flexCol} ${utils.gap3}`}>
      <form onSubmit={handleSubmit} className={`${utils.flex} ${utils.gap3}`}>
        <div className={`${utils.relative} ${utils.flex1}`}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add milk, eggs, flour..."
            className={clay.input}
            disabled={mutation.isPending}
          />
          <button
            type="button"
            onClick={() => setShowExtras(!showExtras)}
            className={`${utils.absolute} ${utils.right3} ${utils.top1_2} ${utils.translateY1_2} ${utils.textSeaInkSoft} ${utils.opacity40} ${utils.hoverOpacity100} ${utils.transitionOpacity}`}
          >
            <Hash className={`${utils.icon} ${showExtras ? 'text-[#a18cd1]' : ''}`} />
          </button>
        </div>
        <button
          type="submit"
          disabled={mutation.isPending || !name.trim()}
          className={`${clay.button} ${utils.flex} ${utils.itemsCenter} ${utils.justifyCenter} ${utils.p3}`}
        >
          <Plus className={utils.iconLg} />
        </button>
      </form>

      {showExtras && (
        <div className={`${clay.card} ${utils.p4} ${utils.grid} ${utils.gridCols1} ${utils.smGridCols3} ${utils.gap3} ${utils.animateIn} ${utils.fadeIn} ${utils.slideInFromTop2} ${utils.rounded2xl}`}>
          <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2}`}>
            <Hash className={`${utils.icon} ${utils.textSeaInkSoft}`} />
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
              className={`${clay.input} ${utils.py1} ${utils.textSm}`}
            />
          </div>
          <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.relative}`}>
            <Tag className={`${utils.icon} ${utils.textSeaInkSoft}`} />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`${clay.input} ${utils.py1} ${utils.textSm} ${utils.appearanceNone} ${utils.pr8}`}
            >
              <option value="">Category...</option>
              {categories?.map((c: Category) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setManagingType('category')}
              className={`${utils.absolute} ${utils.right1} ${utils.p1} ${utils.roundedFull} ${utils.textSeaInkSoft} ${utils.hoverBgLine}`}
              title="Add Category"
            >
              <Plus className={utils.iconXs} />
            </button>
          </div>
          <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2} ${utils.relative}`}>
            <StoreIcon className={`${utils.icon} ${utils.textSeaInkSoft}`} />
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className={`${clay.input} ${utils.py1} ${utils.textSm} ${utils.appearanceNone} ${utils.pr8}`}
            >
              <option value="">Store...</option>
              {stores?.map((s: Store) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setManagingType('store')}
              className={`${utils.absolute} ${utils.right1} ${utils.p1} ${utils.roundedFull} ${utils.textSeaInkSoft} ${utils.hoverBgLine}`}
              title="Add Store"
            >
              <Plus className={utils.iconXs} />
            </button>
          </div>
        </div>
      )}
      
      {error && <p className={`${utils.textXs} ${utils.textRed400} ${utils.ml2}`}>{error}</p>}

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
