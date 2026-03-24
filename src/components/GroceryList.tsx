import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGroceryItemsFn, updateGroceryItemFn, deleteGroceryItemFn, householdSignalFn, getCategoriesFn, getStoresFn } from '../services/grocery.api'
import type { GroceryItem } from '../lib/schemas'
import clay from '../styles/clay.module.css'
import utils from '../styles/utils.module.css'
import { CheckCircle2, Circle, Trash2, Tag, Store as StoreIcon } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import type { Session } from '../lib/schemas'

function useHouseholdSignals() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const ctrl = new AbortController()
    
    const connect = async () => {
      try {
        const response = await householdSignalFn({ signal: ctrl.signal })
        const reader = response.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          if (chunk.includes('data:')) {
            queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
            queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
            queryClient.invalidateQueries({ queryKey: ['household-logs'] })
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setTimeout(connect, 3000)
        }
      }
    }

    connect()
    return () => ctrl.abort()
  }, [queryClient])
}

export default function GroceryList({ session }: { session: Session | null }) {
  const queryClient = useQueryClient()
  useHouseholdSignals()
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = parentRef.current
    if (!el) return

    const handleScroll = () => {
      setIsScrolling(true)
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
      scrollTimeout.current = setTimeout(() => setIsScrolling(false), 150)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const { data: items, isLoading: isLoadingItems, error: itemsError } = useQuery({
    queryKey: ['grocery-items', session?.householdId],
    queryFn: () => getGroceryItemsFn(),
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

  const rowVirtualizer = useWindowVirtualizer({
    count: items?.length || 0,
    estimateSize: () => 110,
    overscan: 10,
    scrollMargin: parentRef.current?.offsetTop || 0,
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; checked: 'true' | 'false' }) =>
      updateGroceryItemFn({ data: { id: vars.id, data: { checked: vars.checked } } }),
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['grocery-items', session?.householdId] })
      const previousItems = queryClient.getQueryData(['grocery-items', session?.householdId])
      queryClient.setQueryData(['grocery-items', session?.householdId], (old: GroceryItem[]) =>
        old.map((item) => (item.id === newItem.id ? { ...item, checked: newItem.checked } : item))
      )
      return { previousItems }
    },
    onError: (_err, _newItem, context) => {
      queryClient.setQueryData(['grocery-items', session?.householdId], context?.previousItems)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items', session?.householdId] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroceryItemFn({ data: id }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['grocery-items', session?.householdId] })
      const previousItems = queryClient.getQueryData(['grocery-items', session?.householdId])
      queryClient.setQueryData(['grocery-items', session?.householdId], (old: GroceryItem[]) =>
        old.filter((item) => item.id !== id)
      )
      return { previousItems }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['grocery-items', session?.householdId], context?.previousItems)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items', session?.householdId] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
    },
  })

  if (isLoadingItems) return <div className={`${utils.textCenter} ${utils.py10}`} style={{ color: 'var(--sea-ink-soft)' }}>Loading list...</div>
  if (itemsError) return <div className={`${utils.textCenter} ${utils.py10} ${utils.textRed400}`}>Error loading list.</div>

  if (!items || items.length === 0) {
    return (
      <div className={`${clay.card} ${utils.textCenter} ${utils.py12} ${utils.p8}`}>
        <p style={{ color: 'var(--sea-ink-soft)' }}>Your list is empty. Add something yummy!</p>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className={`${utils.relative} ${utils.wFull}`}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index]
          if (!item) return null
          
          const category = categories.find(c => c.id === item.categoryId)
          const store = stores.find(s => s.id === item.storeId)
          
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                paddingBottom: '12px',
              }}
            >
              <div 
                className={`${clay.card} ${utils.flex} ${utils.itemsCenter} ${utils.justifyBetween} ${utils.p4} ${utils.smP5} ${utils.transition} ${utils.hoverTranslateY0_5}`}
                style={{ height: 'calc(100% - 12px)' }}
              >
                <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap4} ${utils.flex1}`}>
                  <button
                    onClick={() => updateMutation.mutate({ id: item.id, checked: item.checked === 'true' ? 'false' : 'true' })}
                    className={`${utils.outlineNone} ${utils.transitionTransform} ${utils.activeScale90} ${utils.cursorPointer}`}
                    aria-label={item.checked === 'true' ? 'Uncheck item' : 'Check item'}
                    style={{ background: 'none', border: 'none', padding: 0 }}
                  >
                    {item.checked === 'true' ? (
                      <CheckCircle2 className={`${utils.iconXl} ${utils.dropShadowSm}`} style={{ color: '#84fab0' }} />
                    ) : (
                      <Circle className={`${utils.iconXl} ${utils.opacity60} ${utils.hoverOpacity100} ${utils.transitionOpacity}`} style={{ color: 'var(--sea-ink-soft)' }} />
                    )}
                  </button>
                  <div className={utils.flexCol}>
                    <div className={`${utils.flex} ${utils.itemsCenter} ${utils.gap2}`}>
                      <span className={`${utils.textLg} ${utils.fontBold} ${utils.transition} ${item.checked === 'true' ? `${utils.lineThrough} ${utils.opacity40}` : ''}`} style={{ color: 'var(--sea-ink)' }}>
                        {item.name}
                      </span>
                      {item.quantity !== '1' && (
                        <span className={`${utils.text10px} ${utils.fontBold} ${utils.px2} ${utils.py0_5} ${utils.roundedFull} ${utils.uppercase} ${utils.trackingWider}`} style={{ backgroundColor: 'rgba(161, 140, 209, 0.1)', color: '#a18cd1' }}>
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <div className={`${utils.flex} ${utils.flexWrap} ${utils.gap2} ${utils.mt1}`}>
                      {category && (
                        <span className={`${utils.text10px} ${utils.fontBold} ${utils.flex} ${utils.itemsCenter} ${utils.gap1} ${utils.opacity60} ${utils.uppercase} ${utils.trackingWider} ${utils.px2} ${utils.py0_5} ${utils.rounded} ${utils.border} ${utils.borderLine}`} style={{ backgroundColor: 'var(--sand)', color: 'var(--sea-ink-soft)' }}>
                          <Tag className={utils.icon2_5} /> {category.name}
                        </span>
                      )}
                      {store && (
                        <span className={`${utils.text10px} ${utils.fontBold} ${utils.flex} ${utils.itemsCenter} ${utils.gap1} ${utils.opacity80} ${utils.uppercase} ${utils.trackingWider} ${utils.px2} ${utils.py0_5} ${utils.rounded} ${utils.border}`} style={{ color: '#ff9a9e', backgroundColor: 'rgba(254, 207, 239, 0.3)', borderColor: 'rgba(255, 154, 158, 0.2)' }}>
                          <StoreIcon className={utils.icon2_5} /> {store.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(item.id)}
                  className={`${utils.p2} ${utils.roundedXl} ${utils.textRed400} ${utils.transition} ${utils.activeScale90} ${utils.cursorPointer}`}
                  aria-label="Delete item"
                  style={{ background: 'none', border: 'none' }}
                >
                  <Trash2 className={utils.iconLg} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
