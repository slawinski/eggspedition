# RW-005 — Offline Mutation Queue and Sync Status Integration

**Priority:** P0  
**Maps to:** UX-012, UX-003, UX-004, UX-005, UX-006  
**Primary outcome:** actions accepted while offline are explicitly stored, replayed safely and visible through one trustworthy sync surface.

## Verified implementation

The repository contains:

- `createMutationQueue`;
- persisted household-scoped entries;
- queued/in-flight/failed states;
- retry counters and exponential backoff;
- `useOnlineStatus`;
- `OfflineBanner`;
- `SyncStatusButton`.

These are useful foundations.

## Discrepancies

### Queue is not connected to product mutations

Add, Quick Add, complete, restore, delete and edit still call server functions directly. They do not enqueue when offline or on retryable failure.

### Sync Status receives synthetic empty data

`Header` passes `pendingMutations={[]}`, `failedMutations={[]}` and no-op Retry/Discard callbacks. The global control therefore cannot represent real state.

### Queue retry does not execute

`retry(id)` changes status to queued but deliberately waits for a future `flush`. The UI contract calls this an immediate retry, yet no flush is triggered by the method itself.

### Flush scheduling is incomplete

After a retryable failure, `flush()` waits once and continues the original snapshot of queued entries. It does not guarantee another attempt for the same entry or schedule a later flush.

### Idempotency is documentary only

The queue comments require operation IDs, but current server operations do not accept/store them.

### Storage failure is silent

If localStorage quota/write fails, the queue drops its durability guarantee without surfacing a user-visible failure.

## Product decision

Introduce a single application-level mutation coordinator. Components request domain actions; the coordinator decides whether to execute immediately, enqueue, retry or reconcile.

Components must not:

- inspect `navigator.onLine` to choose their own behavior;
- instantiate their own queues;
- build unrelated retry loops;
- claim “saved” before the coordinator accepts the operation.

## Architecture

Mount a `MutationCoordinatorProvider` inside the authenticated household boundary.

```ts
interface MutationCoordinator {
  dispatch<T extends MutationType>(
    command: MutationCommand<T>,
  ): Promise<LocalAcceptance>
  retry(operationId: string): Promise<void>
  discard(operationId: string): Promise<void>
  subscribe(): QueueSnapshot
}
```

Queue snapshot:

```ts
interface QueueSnapshot {
  pending: QueuedMutation[]
  failed: QueuedMutation[]
  inFlight: QueuedMutation[]
  lastSyncedAt?: number
  storageAvailable: boolean
}
```

Create the queue once per household and dispose/recreate it on household change/logout.

## Mutation lifecycle

```ts
type MutationStatus =
  | 'accepted-local'
  | 'queued-offline'
  | 'in-flight'
  | 'confirmed'
  | 'retry-wait'
  | 'failed'
  | 'discarded'
  | 'conflicted'
```

### Online

1. apply optimistic patch;
2. persist command to queue before network execution;
3. execute;
4. mark confirmed/remove from queue;
5. reconcile canonical result.

Persist-before-send prevents page-close loss.

### Offline

1. apply optimistic patch;
2. persist command;
3. announce “Saved on this device”;
4. show queued count;
5. flush on reconnect.

### Retryable failure

- retain operation;
- schedule retry using `nextAttemptAt`;
- do not block unrelated operations unless ordering dependencies require it.

### Permanent failure/conflict

- mark failed;
- keep enough snapshot to explain impact;
- expose Retry, Review or Discard;
- never loop indefinitely.

## Queue model changes

Extend entry:

```ts
interface QueuedMutation {
  id: string
  householdId: string
  type: MutationType
  payload: SerializablePayload
  optimisticSnapshot: SerializableSnapshot
  createdAt: number
  updatedAt: number
  retryCount: number
  nextAttemptAt: number | null
  status: 'queued' | 'in-flight' | 'failed' | 'conflicted'
  errorCode?: string
}
```

Use IndexedDB rather than localStorage if snapshots or queue volume can grow. If localStorage remains, enforce size limits and explicitly handle quota errors.

## Ordering

Not all operations can replay independently.

Examples:

- create item must confirm or supply a client-generated stable ID before later edit/delete;
- increment bursts for the same item can be coalesced;
- complete then undo can collapse before sending;
- delete supersedes pending edits to the same entity.

Add a compaction layer:

```ts
compact(commands): commands
```

Rules must be deterministic and unit tested.

## Reconnect triggers

Flush when:

- provider initializes;
- browser emits `online`;
- tab becomes visible and online;
- user presses Retry;
- scheduled `nextAttemptAt` is reached.

Prevent multiple concurrent flushes using one lock/promise per household.

## Sync Status UI

Connect `Header` to the provider snapshot.

States:

- hidden/quiet when confirmed;
- `Offline`;
- `2 changes waiting`;
- `Syncing 1 change`;
- `1 change needs attention`.

Details panel lists user-readable operations, not raw payload JSON:

- “Add Milk ×2”
- “Complete Bread”
- “Edit Apples”

Actions:

- Retry;
- Review;
- Discard local change.

Discard applies the stored inverse optimistic snapshot and removes the operation. Destructive discard requires confirmation when it would remove user work.

## Offline banner copy

Offline with no changes:

> “You’re offline. Existing list data may be available.”

Offline after accepted local change:

> “You’re offline. 2 changes are saved on this device.”

Do not say “will sync” if durable storage failed.

## Query behavior

- retain last successful list/activity data;
- show background refresh errors without replacing content;
- mark stale data;
- reconcile server events with local operation IDs to prevent duplicates.

## Security and privacy

- queue is household-scoped;
- logout clears only app-owned queue/cache data;
- switching household cannot replay the prior household’s operations;
- do not persist secrets or invite tokens;
- consider encrypting locally stored item data only if the threat model requires it; do not imply encryption if absent.

## File-level plan

### Add

- `src/providers/MutationCoordinatorProvider.tsx`
- `src/hooks/useMutationCoordinator.ts`
- `src/lib/mutation-executors.ts`
- `src/lib/mutation-compaction.ts`
- `src/lib/queue-storage.ts`

### Modify

- `src/routes/__root.tsx`
- `src/components/Header.tsx`
- `src/components/SyncStatusButton.tsx`
- `src/components/OfflineBanner.tsx`
- all grocery mutation hooks/components;
- `src/lib/mutation-queue.ts`.

## Acceptance criteria

- A user can add, increment, edit, complete and delete while offline.
- Accepted changes survive reload.
- Header reflects the actual queue.
- Reconnect automatically flushes operations exactly once.
- Retry immediately attempts the selected operation.
- Backoff schedules another attempt rather than only waiting.
- Permanent failures remain visible and actionable.
- Discard restores the corresponding optimistic state.
- Server events containing the same operation ID do not duplicate local changes.
- Logout and household switching isolate/clear the correct queue.
- Storage failure is surfaced before claiming local durability.
- Queue tests use a controllable clock and deterministic backoff.

## Tests

- offline add → reload → reconnect;
- create followed by edit compaction;
- complete followed by Undo before sync;
- concurrent flush trigger lock;
- retry scheduling;
- quota/storage failure;
- failed operation Retry/Discard;
- cross-household isolation;
- event/operation reconciliation;
- online/offline transitions during an in-flight request.
