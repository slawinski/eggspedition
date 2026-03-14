import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGroceryItemsFn, updateGroceryItemFn, deleteGroceryItemFn, householdSignalFn } from '../services/grocery.api'
import { GroceryItem } from '../lib/schemas'
import styles from '../styles/clay.module.css'
import { CheckCircle2, Circle, Trash2, Tag, Store as StoreIcon } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useState, useEffect, useCallback } from 'react'

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

export default function GroceryList() {
  const queryClient = useQueryClient()
  useHouseholdSignals()
  const parentRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeout = useRef<Timer | null>(null)

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

  const { data: items, isLoading, error } = useQuery({
    queryKey: ['grocery-items'],
    queryFn: () => getGroceryItemsFn(),
  })

  const rowVirtualizer = useVirtualizer({
    count: items?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90,
    overscan: 5,
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; checked: 'true' | 'false' }) =>
      updateGroceryItemFn({ data: { id: vars.id, data: { checked: vars.checked } } }),
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['grocery-items'] })
      const previousItems = queryClient.getQueryData(['grocery-items'])
      queryClient.setQueryData(['grocery-items'], (old: GroceryItem[]) =>
        old.map((item) => (item.id === newItem.id ? { ...item, checked: newItem.checked } : item))
      )
      return { previousItems }
    },
    onError: (err, newItem, context) => {
      queryClient.setQueryData(['grocery-items'], context?.previousItems)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroceryItemFn({ data: id }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['grocery-items'] })
      const previousItems = queryClient.getQueryData(['grocery-items'])
      queryClient.setQueryData(['grocery-items'], (old: GroceryItem[]) =>
        old.filter((item) => item.id !== id)
      )
      return { previousItems }
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(['grocery-items'], context?.previousItems)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
    },
  })

  if (isLoading) return <div className="text-center py-10 text-[var(--sea-ink-soft)]">Loading list...</div>
  if (error) return <div className="text-center py-10 text-red-400">Error loading list.</div>

  if (!items || items.length === 0) {
    return (
      <div className={`${styles.card} text-center py-12`}>
        <p className="text-[var(--sea-ink-soft)]">Your list is empty. Add something yummy!</p>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className={`max-h-[60vh] overflow-auto pr-2 custom-scrollbar ${isScrolling ? styles.scrolling : ''}`}
      style={{
        contain: 'strict',
      }}
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
          
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '16px',
              }}
            >
              <div className={`${styles.card} flex items-center justify-between p-4 sm:p-5 transition-all hover:translate-y-[-2px] h-full`}>
                <div className="flex items-center gap-4 flex-1">
                  <button
                    onClick={() => updateMutation.mutate({ id: item.id, checked: item.checked === 'true' ? 'false' : 'true' })}
                    className="focus:outline-none transition-transform active:scale-90"
                  >
                    {item.checked === 'true' ? (
                      <CheckCircle2 className="h-6 w-6 text-[#84fab0]" />
                    ) : (
                      <Circle className="h-6 w-6 text-[var(--sea-ink-soft)] opacity-40" />
                    )}
                  </button>
                  <div className="flex flex-col">
                    <span className={`text-lg font-medium transition-all ${item.checked === 'true' ? 'line-through opacity-40' : 'text-[var(--sea-ink)]'}`}>
                      {item.name}
                    </span>
                    <div className="flex gap-3 mt-1">
                      {item.quantity !== '1' && (
                        <span className="text-xs bg-[rgba(161,140,209,0.1)] px-2 py-0.5 rounded-full text-[#a18cd1]">
                          {item.quantity}
                        </span>
                      )}
                      {item.categoryId && (
                        <span className="text-xs flex items-center gap-1 opacity-60">
                          <Tag className="h-3 w-3" /> Category
                        </span>
                      )}
                      {item.storeId && (
                        <span className="text-xs flex items-center gap-1 opacity-60">
                          <StoreIcon className="h-3 w-3" /> Store
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(item.id)}
                  className="p-2 rounded-xl text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
