import { useCallback, useId } from 'react'
import type { QueuedMutation } from '../lib/mutation-queue'

/** Per-item operation state returned by the hook. */
export interface MutationStatus {
  status: 'pending' | 'confirmed' | 'failed' | 'queued'
  /** Stable operation ID for this mutation attempt. */
  operationId: string
  /** Human-readable item name (for feedback copy like "Couldn't add Milk."). */
  itemName: string
  /** Retries this specific mutation (replays from the queue). */
  retry: () => void
}

interface UseMutationStatusOptions {
  /**
   * A mutation-queue manager (created via `createMutationQueue`).
   * If not provided the hook operates in a pass-through mode where
   * `status` mirrors the raw input.
   */
  queue?: {
    get: (id: string) => QueuedMutation | undefined
    retry: (id: string) => void
    discard: (id: string) => void
  }

  /** Human-readable name of the entity being mutated. */
  itemName: string

  /**
   * If provided, the hook will look up this operation ID in the queue
   * to determine whether it's still queued or has failed.
   */
  operationId?: string

  /**
   * Raw mutation status from React Query / your data layer.
   * The hook combines this with queue state to produce the resolved status.
   */
  rawStatus: 'idle' | 'pending' | 'success' | 'error'
}

/**
 * useMutationStatus — combines raw mutation state (from React Query)
 * with the offline mutation queue to produce a unified per-item status.
 *
 * Priority order:
 *   queued > error/failed > pending > confirmed
 */
export function useMutationStatus({
  queue,
  itemName,
  operationId,
  rawStatus,
}: UseMutationStatusOptions): MutationStatus {
  const stableId = useId()
  const opId = operationId ?? stableId
  const queueEntry = operationId && queue ? queue.get(operationId) : undefined

  // Resolve combined status
  let status: MutationStatus['status'] = 'pending'

  if (queueEntry) {
    status = queueEntry.status === 'failed' ? 'failed' : 'queued'
  } else if (rawStatus === 'error') {
    status = 'failed'
  } else if (rawStatus === 'success') {
    status = 'confirmed'
  } else if (rawStatus === 'idle') {
    status = 'pending' // still waiting for server ack
  }

  const retry = useCallback(() => {
    if (queue && opId) {
      queue.retry(opId)
    }
  }, [queue, opId])

  return {
    status,
    operationId: opId,
    itemName,
    retry,
  }
}
