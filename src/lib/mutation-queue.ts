/**
 * mutation-queue — Offline-capable mutation queue manager.
 *
 * Persists queued mutations to localStorage keyed by household so
 * operations survive page reloads.  Replays the queue on reconnect
 * and at app start, with exponential backoff for transient failures.
 *
 * All queued commands are serialisable JSON; operation IDs enable
 * idempotency checks server-side.
 */

/* ── Types ── */

export interface QueuedMutation {
  /** Unique operation ID (UUID or nanoid). Used for idempotency. */
  id: string
  /** Household scope — mutations are isolated per household. */
  householdId: string
  /** Action type, e.g. "addGroceryItem", "deleteGroceryItem". */
  type: string
  /** Serializable payload matching the server function input. */
  payload: unknown
  /** Unix-ms timestamp of when the mutation was first queued. */
  timestamp: number
  /** How many times this mutation has been retried. */
  retryCount: number
  /** Current status in the queue lifecycle. */
  status: 'queued' | 'in-flight' | 'failed'
}

interface QueueStore {
  mutations: QueuedMutation[]
}

type ExecutorFn = (mutation: QueuedMutation) => Promise<void>

interface MutationQueueOptions {
  /** Maximum retry attempts before marking a mutation as 'failed'. */
  maxRetries?: number
  /** Base delay in ms for exponential backoff (default 1000). */
  backoffBaseMs?: number
  /** Maximum backoff delay in ms (default 30000 = 30s). */
  backoffMaxMs?: number
}

/* ── Public API ── */

export interface MutationQueueManager {
  /** Enqueue a new mutation. Automatically persists to localStorage. */
  enqueue: (mutation: Omit<QueuedMutation, 'retryCount' | 'status'>) => void
  /** Get a specific mutation by ID. */
  get: (id: string) => QueuedMutation | undefined
  /** Remove a mutation from the queue and persistence. */
  discard: (id: string) => void
  /** Retry a specific mutation immediately. */
  retry: (id: string) => void
  /** Flush all queued mutations for the household (replay). */
  flush: () => Promise<void>
  /** Snapshot of current queue entries. */
  getAll: () => QueuedMutation[]
  /** Subscribe to queue changes. Returns an unsubscribe function. */
  subscribe: (listener: () => void) => () => void
}

/* ── Storage key ── */

const STORAGE_PREFIX = 'eggspedition:mutation-queue'

function storageKey(householdId: string): string {
  return `${STORAGE_PREFIX}:${householdId}`
}

function loadFromStorage(householdId: string): QueuedMutation[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(householdId))
    if (!raw) return []
    const store: QueueStore = JSON.parse(raw)
    return Array.isArray(store.mutations) ? store.mutations : []
  } catch {
    return []
  }
}

function saveToStorage(householdId: string, mutations: QueuedMutation[]) {
  if (typeof localStorage === 'undefined') return
  try {
    const store: QueueStore = { mutations }
    localStorage.setItem(storageKey(householdId), JSON.stringify(store))
  } catch {
    // Storage quota exceeded — mutations may be lost.
    // In production, we'd surface this to the user.
  }
}

/* ── Backoff helper ── */

function backoffDelay(retryCount: number, baseMs: number, maxMs: number): number {
  const delay = baseMs * Math.pow(2, retryCount)
  // Add ±15% jitter to prevent thundering herd
  const jitter = delay * 0.15 * (Math.random() * 2 - 1)
  return Math.min(delay + jitter, maxMs)
}

/* ── Factory ── */

/**
 * Creates a new mutation-queue manager for a given household and executor.
 *
 * The `executor` receives a QueuedMutation and should call the
 * corresponding server function.  If it throws, the mutation is
 * retried with exponential backoff up to `maxRetries` times.
 *
 * Usage:
 * ```ts
 * const queue = createMutationQueue(householdId, async (m) => {
 *   if (m.type === 'addGroceryItem') {
 *     await addGroceryItemFn({ data: m.payload })
 *   }
 * })
 *
 * // Enqueue when offline:
 * queue.enqueue({ id: crypto.randomUUID(), householdId, type: 'addGroceryItem', payload: {...}, timestamp: Date.now() })
 *
 * // Flush on reconnect:
 * await queue.flush()
 * ```
 */
export function createMutationQueue(
  householdId: string,
  executor: ExecutorFn,
  options: MutationQueueOptions = {},
): MutationQueueManager {
  const { maxRetries = 3, backoffBaseMs = 1000, backoffMaxMs = 30000 } = options

  let mutations = loadFromStorage(householdId)

  // Reset any 'in-flight' mutations back to 'queued' (crashed mid-flight)
  mutations = mutations.map((m) =>
    m.status === 'in-flight' ? { ...m, status: 'queued' as const } : m,
  )
  saveToStorage(householdId, mutations)

  const listeners = new Set<() => void>()

  function notify(): void {
    for (const l of listeners) l()
  }

  function persist(): void {
    saveToStorage(householdId, mutations)
    notify()
  }

  function enqueue(mutation: Omit<QueuedMutation, 'retryCount' | 'status'>): void {
    const entry: QueuedMutation = {
      ...mutation,
      retryCount: 0,
      status: 'queued',
    }
    // Avoid duplicates by id
    const existing = mutations.findIndex((m) => m.id === entry.id)
    if (existing !== -1) {
      mutations[existing] = entry
    } else {
      mutations.push(entry)
    }
    persist()
  }

  function get(id: string): QueuedMutation | undefined {
    return mutations.find((m) => m.id === id)
  }

  function discard(id: string): void {
    mutations = mutations.filter((m) => m.id !== id)
    persist()
  }

  function retry(id: string): void {
    const idx = mutations.findIndex((m) => m.id === id)
    if (idx === -1) return
    mutations[idx] = { ...mutations[idx], status: 'queued', retryCount: 0 }
    persist()
    // Fire-and-forget — the mutation will be picked up on next flush
  }

  async function flush(): Promise<void> {
    const queued = mutations.filter((m) => m.status === 'queued')
    // Sort by timestamp to preserve order within a household
    queued.sort((a, b) => a.timestamp - b.timestamp)

    for (const mutation of queued) {
      // Mark in-flight
      const idx = mutations.findIndex((m) => m.id === mutation.id)
      if (idx === -1) continue
      mutations[idx] = { ...mutations[idx], status: 'in-flight' }
      persist()

      try {
        await executor(mutation)
        // Success — remove from queue
        mutations = mutations.filter((m) => m.id !== mutation.id)
        persist()
      } catch {
        const current = mutations.find((m) => m.id === mutation.id)
        if (!current) continue

        const nextCount = current.retryCount + 1
        if (nextCount >= maxRetries) {
          mutations = mutations.map((m) =>
            m.id === mutation.id ? { ...m, status: 'failed' as const, retryCount: nextCount } : m,
          )
        } else {
          mutations = mutations.map((m) =>
            m.id === mutation.id ? { ...m, status: 'queued' as const, retryCount: nextCount } : m,
          )
        }
        persist()

        // Exponential backoff before retrying the next queued item
        await new Promise((resolve) =>
          setTimeout(resolve, backoffDelay(nextCount, backoffBaseMs, backoffMaxMs)),
        )
      }
    }
  }

  function getAll(): QueuedMutation[] {
    return mutations
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  return { enqueue, get, discard, retry, flush, getAll, subscribe }
}
