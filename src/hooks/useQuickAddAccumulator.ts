import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '../lib/schemas'
import { createQuickAddAnnouncer } from '../lib/quickAddLiveRegion'
import {
  useQuickAddQuantitySync,
  type QuickAddItemIdentity,
} from './useQuickAddQuantitySync'

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * The full interaction state for a single Quick Add item.
 *
 *   optimisticQuantity  – Rendered immediately on every tap (the badge number).
 *   confirmedQuantity   – Last value the server confirmed (fallback on error).
 *   unsentDelta         – Taps collected since the last flush began.
 *   inFlightDelta       – Taps that have been sent but not yet acknowledged.
 *   repeatWindowEndsAt  – Timestamp (ms) when the 1 s repeat window closes.
 *   retryCount          – Number of consecutive failures for this item.
 *   phase               – Current lifecycle phase.
 */
export interface QuickAddInteractionState {
  optimisticQuantity: number
  confirmedQuantity: number
  unsentDelta: number
  inFlightDelta: number
  repeatWindowEndsAt: number
  retryCount: number
  phase: 'idle' | 'active' | 'syncing' | 'failed'
}

export const DEFAULT_INTERACTION_STATE: QuickAddInteractionState = {
  optimisticQuantity: 0,
  confirmedQuantity: 0,
  unsentDelta: 0,
  inFlightDelta: 0,
  repeatWindowEndsAt: 0,
  retryCount: 0,
  phase: 'idle',
}

export interface UseQuickAddAccumulatorOptions {
  /** Current session — syncs are skipped when null. */
  session: Session | null
  /** Called when all items have finished syncing (no pending deltas). */
  onMutationSettled?: () => void
}

export interface UseQuickAddAccumulatorReturn {
  /**
   * Read the current interaction state for an item. Call this during render;
   * the returned object is stable per tick (see `tick`).
   */
  getState: (key: string) => QuickAddInteractionState

  /**
   * A monotonically increasing counter that changes whenever any item's
   * visual state (progress, phase) changes. The consuming component should
   * use this as a render dependency so it re-reads `getState`.
   */
  tick: number

  /**
   * Record a tap on an item. Increments the optimistic quantity immediately,
   * restarts the repeat window, and schedules a server sync.
   *
   * The button MUST NOT be disabled while the window is active — the hook
   * handles all timing and sync logic internally.
   */
  tap: (item: {
    key: string
    name: string
    categoryId?: string | null
    storeId?: string | null
  }) => void

  /** Check whether the item's repeat window is still open. */
  isInRepeatWindow: (key: string) => boolean

  /** Force-flush any pending deltas for an item (e.g. on unmount). */
  flush: (key: string) => void

  /** Remove all state for a key and cancel pending timers. */
  removeState: (key: string) => void
}

// ── Internal helpers ───────────────────────────────────────────────────────────

const REPEAT_WINDOW_MS = 1000
const MAX_RETRIES = 3
const ANNOUNCE_DEBOUNCE_MS = 350

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useQuickAddAccumulator(
  options: UseQuickAddAccumulatorOptions,
): UseQuickAddAccumulatorReturn {
  const { session, onMutationSettled } = options

  // ── Refs (avoid render thrashing during rapid taps) ──────────────────────
  const entriesRef = useRef<
    Map<
      string,
      {
        identity: QuickAddItemIdentity
        state: QuickAddInteractionState
        retryTimeout: ReturnType<typeof setTimeout> | null
      }
    >
  >(new Map())

  // A single tick counter that the rAF loop bumps when visual state changes.
  const [tick, setTick] = useState(0)

  // ── Announcer ────────────────────────────────────────────────────────────
  const announcerRef = useRef<ReturnType<typeof createQuickAddAnnouncer> | null>(
    null,
  )

  useEffect(() => {
    announcerRef.current = createQuickAddAnnouncer()
    return () => {
      announcerRef.current?.destroy()
      announcerRef.current = null
    }
  }, [])

  // ── Quantity sync ────────────────────────────────────────────────────────
  const onDeltaConfirmedRef = useRef<
    ((key: string, resultingQuantity: number) => void) | null
  >(null)
  const onDeltaFailedRef = useRef<
    ((key: string, attemptedDelta: number) => void) | null
  >(null)

  const { syncDelta } = useQuickAddQuantitySync({
    onDeltaConfirmed: (key, resultingQuantity) => {
      onDeltaConfirmedRef.current?.(key, resultingQuantity)
    },
    onDeltaFailed: (key, attemptedDelta) => {
      onDeltaFailedRef.current?.(key, attemptedDelta)
    },
  })

  // ── Flush logic (called when window expires or retry fires) ─────────────
  const flush = useCallback(
    (key: string) => {
      const entry = entriesRef.current.get(key)
      if (!entry) return

      const { state, identity } = entry

      // Nothing to send
      if (state.unsentDelta === 0 && state.inFlightDelta === 0) return

      // Already syncing — let the completion handler re-trigger
      if (state.inFlightDelta > 0) return

      // Guard: no session means no network
      if (!session?.householdId) return

      const deltaToSend = state.unsentDelta
      if (deltaToSend <= 0) return

      // Move unsent → in-flight
      state.unsentDelta = 0
      state.inFlightDelta = deltaToSend
      state.phase = 'syncing'
      state.repeatWindowEndsAt = 0

      // Bump tick so the UI reflects 'syncing'
      setTick((t) => t + 1)

      syncDelta(key, identity, deltaToSend)
    },
    [session, syncDelta],
  )

  // ── Delta confirmed handler (stable ref, no stale closure) ──────────────
  onDeltaConfirmedRef.current = useCallback(
    (key: string, resultingQuantity: number) => {
      const entry = entriesRef.current.get(key)
      if (!entry) return

      entry.state.confirmedQuantity = resultingQuantity
      entry.state.optimisticQuantity = resultingQuantity + entry.state.unsentDelta
      entry.state.inFlightDelta = 0

      if (entry.state.unsentDelta > 0) {
        // More taps accumulated while syncing — flush immediately
        flush(key)
      } else {
        entry.state.phase = 'idle'
        entry.state.retryCount = 0
        setTick((t) => t + 1)
      }

      // Check global settled state
      checkAllSettled()
    },
    [flush],
  )

  // ── Delta failed handler (exponential backoff up to MAX_RETRIES) ────────
  onDeltaFailedRef.current = useCallback(
    (key: string, attemptedDelta: number) => {
      const entry = entriesRef.current.get(key)
      if (!entry) return

      entry.state.inFlightDelta = 0
      entry.state.retryCount += 1

      if (entry.state.retryCount <= MAX_RETRIES) {
        // Move attempted delta back into unsent for retry
        entry.state.unsentDelta += attemptedDelta
        entry.state.phase = 'failed'
        setTick((t) => t + 1)

        // Exponential backoff: 1s, 2s, 4s, capped at 8s
        const backoffMs = Math.min(
          1000 * Math.pow(2, entry.state.retryCount - 1),
          8000,
        )

        const tid = setTimeout(() => {
          const e = entriesRef.current.get(key)
          if (e && e.state.unsentDelta > 0 && e.state.phase === 'failed') {
            e.state.phase = 'active'
            e.state.repeatWindowEndsAt = Date.now() + REPEAT_WINDOW_MS
            setTick((t) => t + 1)
            flush(key)
          }
          if (e) e.retryTimeout = null
        }, backoffMs)

        // Clear previous retry timeout if any
        if (entry.retryTimeout) clearTimeout(entry.retryTimeout)
        entry.retryTimeout = tid
      } else {
        // Max retries exceeded — restore delta so user sees it
        entry.state.unsentDelta += attemptedDelta
        entry.state.phase = 'failed'
        entry.state.retryCount = MAX_RETRIES
        setTick((t) => t + 1)

        // Announce failure
        announcerRef.current?.announce(
          `Failed to add ${entry.identity.name}. Tap to try again.`,
        )
      }
    },
    [flush],
  )

  // ── Check if all items are settled ───────────────────────────────────────
  const checkAllSettled = useCallback(() => {
    if (!onMutationSettled) return
    for (const [, entry] of entriesRef.current) {
      if (
        entry.state.unsentDelta > 0 ||
        entry.state.inFlightDelta > 0 ||
        entry.state.phase === 'syncing'
      ) {
        return // still pending
      }
    }
    onMutationSettled()
  }, [onMutationSettled])

  // ── Tap: the core interaction ───────────────────────────────────────────
  const tap = useCallback(
    (item: {
      key: string
      name: string
      categoryId?: string | null
      storeId?: string | null
    }) => {
      let entry = entriesRef.current.get(item.key)

      if (!entry) {
        entry = {
          identity: {
            name: item.name,
            categoryId: item.categoryId,
            storeId: item.storeId,
          },
          state: { ...DEFAULT_INTERACTION_STATE },
          retryTimeout: null,
        }
        entriesRef.current.set(item.key, entry)
      }

      const state = entry.state

      // 1. Increment optimistic quantities
      state.unsentDelta += 1
      state.optimisticQuantity =
        state.confirmedQuantity + state.unsentDelta + state.inFlightDelta

      // 2. (Re)start the repeat window
      state.repeatWindowEndsAt = Date.now() + REPEAT_WINDOW_MS

      // 3. Move to active phase (recovering from failed state if needed)
      if (state.phase !== 'syncing') {
        state.phase = 'active'
      }

      // 4. Clear any pending retry timeout (tapping resets backoff)
      if (entry.retryTimeout) {
        clearTimeout(entry.retryTimeout)
        entry.retryTimeout = null
      }
      state.retryCount = 0

      // 5. Bump tick for immediate UI update
      setTick((t) => t + 1)

      // 6. Debounced accessible announcement
      announcerRef.current?.announceDebounced(
        `${item.name} x${state.optimisticQuantity} in list`,
        ANNOUNCE_DEBOUNCE_MS,
      )
    },
    [],
  )

  // ── isInRepeatWindow ─────────────────────────────────────────────────────
  const isInRepeatWindow = useCallback((key: string): boolean => {
    const entry = entriesRef.current.get(key)
    if (!entry) return false
    return Date.now() < entry.state.repeatWindowEndsAt
  }, [])

  // ── removeState ──────────────────────────────────────────────────────────
  const removeState = useCallback((key: string) => {
    const entry = entriesRef.current.get(key)
    if (entry?.retryTimeout) {
      clearTimeout(entry.retryTimeout)
    }
    entriesRef.current.delete(key)
  }, [])

  // ── rAF loop: progress tracking + window-expiry detection ──────────────
  useEffect(() => {
    let rafId: number | null = null

    const loop = () => {
      let needsTick = false
      const now = Date.now()

      for (const [key, entry] of entriesRef.current) {
        const state = entry.state

        // Check for window expiry (only when active with pending delta)
        if (
          state.phase === 'active' &&
          state.unsentDelta > 0 &&
          state.repeatWindowEndsAt > 0 &&
          now >= state.repeatWindowEndsAt
        ) {
          flush(key)
          needsTick = true
        }

        // Check for progress change (for timer visualization)
        if (
          state.phase === 'active' &&
          state.repeatWindowEndsAt > 0 &&
          now < state.repeatWindowEndsAt
        ) {
          // Progress is computed on read — we just need to keep ticking
          // while any window is open
          needsTick = true
        }
      }

      if (needsTick) {
        setTick((t) => t + 1)
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [flush])

  // ── getState ─────────────────────────────────────────────────────────────
  const getState = useCallback(
    (key: string): QuickAddInteractionState => {
      const entry = entriesRef.current.get(key)
      if (!entry) return DEFAULT_INTERACTION_STATE
      return entry.state
    },
    // Re-create when tick changes so consuming components re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  )

  return {
    getState,
    tick,
    tap,
    isInRepeatWindow,
    flush,
    removeState,
  }
}
