import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
import TagManager from '../../components/TagManager'
import {
  getCategoriesFn,
  getStoresFn,
  getGroceryItemsFn,
  updateCategoryFn,
  deleteCategoryFn,
  updateStoreFn,
  deleteStoreFn,
} from '../../services/grocery.api'
import styles from './household.module.css'

export const Route = createFileRoute('/settings/tags')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    if (!context.session.householdId) {
      throw redirect({ to: '/onboarding/household' })
    }
  },
  loader: async ({ context }) => {
    if (!context.session?.householdId) return null

    const { queryClient } = context
    const householdId = context.session.householdId

    await Promise.all([
      queryClient.ensureQueryData({
        queryKey: ['categories', householdId],
        queryFn: () => getCategoriesFn(),
      }),
      queryClient.ensureQueryData({
        queryKey: ['stores', householdId],
        queryFn: () => getStoresFn(),
      }),
      queryClient.ensureQueryData({
        queryKey: ['grocery-items', householdId],
        queryFn: () => getGroceryItemsFn(),
      }),
    ])

    return { householdId }
  },
  component: TagsSettings,
})

function TagsSettings() {
  const { session } = Route.useRouteContext()
  const householdId = session?.householdId
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState('')

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

  const { data: items = [] } = useQuery({
    queryKey: ['grocery-items', householdId],
    queryFn: () => getGroceryItemsFn(),
    enabled: !!householdId,
  })

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) {
      if (item.categoryId) counts[item.categoryId] = (counts[item.categoryId] ?? 0) + 1
    }
    return counts
  }, [items])

  const storeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) {
      if (item.storeId) counts[item.storeId] = (counts[item.storeId] ?? 0) + 1
    }
    return counts
  }, [items])

  const normalizedFilter = filter.trim().toLowerCase()
  const filteredCategories = normalizedFilter
    ? categories.filter((c) => c.name.toLowerCase().includes(normalizedFilter))
    : categories
  const filteredStores = normalizedFilter
    ? stores.filter((s) => s.name.toLowerCase().includes(normalizedFilter))
    : stores
  const noMatches = normalizedFilter.length > 0
    && filteredCategories.length === 0
    && filteredStores.length === 0

  const [catMsg, setCatMsg] = useState<{ status: string | null; error: string | null }>({
    status: null,
    error: null,
  })
  const [storeMsg, setStoreMsg] = useState<{ status: string | null; error: string | null }>({
    status: null,
    error: null,
  })
  const [pendingTag, setPendingTag] = useState<{ type: 'category' | 'store'; id: string } | null>(null)

  function invalidateTagQueries() {
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['stores'] })
    queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
    queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
    queryClient.invalidateQueries({ queryKey: ['household-logs'] })
  }

  function toErrorMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback
  }

  const renameCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateCategoryFn({ data: { id, name } }),
    onMutate: ({ id }) => {
      setPendingTag({ type: 'category', id })
      setCatMsg({ status: null, error: null })
    },
    onSuccess: (result) => {
      setCatMsg({
        status: result.merged
          ? `Merged into "${result.entry.name}" — moved ${result.movedItems} item${result.movedItems === 1 ? '' : 's'}.`
          : `Renamed to "${result.entry.name}".`,
        error: null,
      })
      invalidateTagQueries()
    },
    onError: (err) => {
      setCatMsg({ status: null, error: toErrorMessage(err, 'Could not rename category.') })
    },
    onSettled: () => setPendingTag(null),
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategoryFn({ data: id }),
    onMutate: (id) => {
      setPendingTag({ type: 'category', id })
      setCatMsg({ status: null, error: null })
    },
    onSuccess: (result) => {
      const n = result.unassignedItems
      setCatMsg({
        status: n === 0
          ? 'Deleted. It was not used by any items.'
          : `Deleted. ${n} item${n === 1 ? '' : 's'} moved to Uncategorized.`,
        error: null,
      })
      invalidateTagQueries()
    },
    onError: (err) => {
      setCatMsg({ status: null, error: toErrorMessage(err, 'Could not delete category.') })
    },
    onSettled: () => setPendingTag(null),
  })

  const renameStoreMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateStoreFn({ data: { id, name } }),
    onMutate: ({ id }) => {
      setPendingTag({ type: 'store', id })
      setStoreMsg({ status: null, error: null })
    },
    onSuccess: (result) => {
      setStoreMsg({
        status: result.merged
          ? `Merged into "${result.entry.name}" — moved ${result.movedItems} item${result.movedItems === 1 ? '' : 's'}.`
          : `Renamed to "${result.entry.name}".`,
        error: null,
      })
      invalidateTagQueries()
    },
    onError: (err) => {
      setStoreMsg({ status: null, error: toErrorMessage(err, 'Could not rename store.') })
    },
    onSettled: () => setPendingTag(null),
  })

  const deleteStoreMutation = useMutation({
    mutationFn: (id: string) => deleteStoreFn({ data: id }),
    onMutate: (id) => {
      setPendingTag({ type: 'store', id })
      setStoreMsg({ status: null, error: null })
    },
    onSuccess: (result) => {
      const n = result.unassignedItems
      setStoreMsg({
        status: n === 0
          ? 'Deleted. It was not used by any items.'
          : `Deleted. ${n} item${n === 1 ? '' : 's'} moved to Any Store.`,
        error: null,
      })
      invalidateTagQueries()
    },
    onError: (err) => {
      setStoreMsg({ status: null, error: toErrorMessage(err, 'Could not delete store.') })
    },
    onSettled: () => setPendingTag(null),
  })

  if (!householdId) {
    return (
      <main id="main-content" className={styles.page}>
        <div className={styles.loading}>
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          <span>Loading...</span>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className={styles.page}>
      <Link to="/settings/household" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to settings
      </Link>

      <h1 className={styles.title}>Categories &amp; stores</h1>
      <p className={styles.subtitle}>Rename typos, merge duplicates, or remove entries you no longer need.</p>

      <div className={styles.section}>
        <div className={styles.nameForm} role="search">
          <Search size={16} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--sea-ink-soft)' }} />
          <input
            type="search"
            className={styles.nameInput}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter categories & stores…"
            aria-label="Filter categories and stores"
          />
        </div>
      </div>

      {noMatches ? (
        <p className={styles.emptyText}>No matches for &ldquo;{filter.trim()}&rdquo;.</p>
      ) : (
        <>
          {filteredCategories.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Categories</h2>
              <TagManager
                type="category"
                tags={filteredCategories}
                usageCounts={categoryCounts}
                pendingId={pendingTag?.type === 'category' ? pendingTag.id : null}
                status={catMsg.status}
                error={catMsg.error}
                onRename={(id, name) => renameCategoryMutation.mutate({ id, name })}
                onDelete={(id) => deleteCategoryMutation.mutate(id)}
                onDismissMessage={() => setCatMsg({ status: null, error: null })}
              />
            </div>
          )}

          {filteredStores.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Stores</h2>
              <TagManager
                type="store"
                tags={filteredStores}
                usageCounts={storeCounts}
                pendingId={pendingTag?.type === 'store' ? pendingTag.id : null}
                status={storeMsg.status}
                error={storeMsg.error}
                onRename={(id, name) => renameStoreMutation.mutate({ id, name })}
                onDelete={(id) => deleteStoreMutation.mutate(id)}
                onDismissMessage={() => setStoreMsg({ status: null, error: null })}
              />
            </div>
          )}
        </>
      )}
    </main>
  )
}
