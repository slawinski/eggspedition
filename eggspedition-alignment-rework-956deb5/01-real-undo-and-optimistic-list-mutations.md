# RW-001 — Real Undo and Optimistic List Mutations

**Priority:** P0  
**Maps to:** UX-004, UX-006, UX-009, UX-012  
**Primary outcome:** completing, restoring or deleting an item changes the interface immediately and the Undo action genuinely restores server and client state.

## Verified implementation

The current revision contains a useful command framework:

- `UndoProvider` and a shared toast viewport are mounted in `src/routes/__root.tsx`;
- `useUndo` tracks commands, expiry and aggregation;
- `useOptimisticMutation` supports cache updates and a command factory;
- `src/lib/mutation-commands.ts` creates complete, restore and delete commands;
- `SmartView` uses the mutation wrapper for completion and deletion.

## Discrepancies

### 1. List mutations are not actually optimistic

`SmartView` supplies `mutationFn`, invalidation keys and `commandFactory`, but no `optimisticUpdate`. The row remains dependent on the server round trip and later query invalidation.

### 2. Undo is registered after successful execution

`useOptimisticMutation` creates/pushes the command from the returned result. This means:

- the command does not own the original operation;
- before-state capture occurs too late;
- the toast can only appear after the network response;
- the architecture cannot cleanly support offline or delayed mutations.

### 3. Completion captures the wrong previous state

`createCompleteCommand(result, …)` receives the already-updated item. It creates `previousSnapshot` from that result, then creates an item snapshot with `checked: 'true'`. Both snapshots can therefore represent the completed state.

### 4. Cache patches contain no restorable data

`emptyCachePatches` stores `data: undefined`. The default rollback invalidates queries rather than restoring an actual prior cache state.

### 5. Undo does not perform inverse server mutations

For SmartView commands, no operation-specific rollback is supplied. The default rollback only invalidates query keys. The completed/deleted record remains changed on the server.

### 6. Delete restoration needs an exact snapshot

An inverse delete must restore name, quantity, checked state, category, store and stable identity. Re-adding by name is not equivalent and may merge with another active item.

## Product decision

Treat Undo as a domain transaction, not a toast convenience.

Each undoable action must have:

1. a **before snapshot** captured before mutation;
2. an **optimistic client patch**;
3. a **forward server command**;
4. an **inverse server command**;
5. an operation ID used for idempotency;
6. reconciliation behavior for success, failure and offline replay.

The Undo button reverses the latest eligible command. It must never claim success when it only refetched unchanged server data.

## Required command contract

Replace passive command metadata with an executable command envelope:

```ts
type GroceryCommand =
  | {
      id: string
      type: 'setChecked'
      householdId: string
      itemId: string
      before: GroceryItemSnapshot
      after: GroceryItemSnapshot
      expectedVersion?: number
      createdAt: number
      expiresAt: number
    }
  | {
      id: string
      type: 'deleteItem'
      householdId: string
      itemId: string
      before: GroceryItemSnapshot
      after: null
      expectedVersion?: number
      createdAt: number
      expiresAt: number
    }
```

Create a command executor:

```ts
interface GroceryCommandExecutor {
  execute(command: GroceryCommand): Promise<CommandResult>
  undo(command: GroceryCommand): Promise<CommandResult>
}
```

Do not serialize closures into persistence. Map command types to executor functions.

## Server operations

Add explicit server functions:

```ts
setGroceryItemChecked({
  itemId,
  checked,
  operationId,
  expectedVersion,
})

deleteGroceryItem({
  itemId,
  operationId,
  expectedVersion,
})

restoreDeletedGroceryItem({
  deletedItemId,
  snapshot,
  operationId,
})
```

Server requirements:

- derive `householdId` from the authenticated session;
- select/update/delete with `itemId AND householdId`;
- reject stale `expectedVersion` with a typed conflict;
- record `operationId`;
- return the canonical item/event;
- make repeated requests with the same operation ID return the original result;
- restore a deleted item without silently merging it with another active item.

A soft-delete/event-snapshot model is preferred. It preserves the original item ID and gives Activity a reliable recovery target.

## Client implementation

### Step 1 — capture before state

In `SmartView`, locate the item before invoking the mutation. Construct the command synchronously from this object.

### Step 2 — optimistically patch all active views

Create query-data helpers rather than ad hoc mutations:

```ts
patchItemInGroupedData(...)
removeItemFromGroupedData(...)
insertItemIntoGroupedData(...)
patchItemInFlatList(...)
patchShoppingProgress(...)
```

Patch every cache that may be mounted:

- `grocery-items`;
- grouped by category;
- grouped by store;
- shopping view data;
- frequent/Quick Add derived data only where semantically affected.

Snapshot prior cache values in `onMutate` and return them as context.

### Step 3 — show Undo immediately

Push the command when the optimistic change is accepted locally, not after server success. The toast text should reflect the local committed action:

- “Milk completed”
- “Milk restored”
- “2× Apples deleted”

### Step 4 — execute and reconcile

- Success: replace optimistic data with canonical returned data without visible jumping.
- Failure before Undo: restore previous caches and remove/replace the toast with a failure message and Retry.
- Undo while forward request is pending: mark `undoRequested`; either cancel if supported or execute the inverse after the forward operation resolves.
- Offline: queue the command through RW-005 and keep it marked as pending.

### Step 5 — execute inverse

Undo must call the domain inverse and optimistically restore the prior snapshot. If inverse execution fails, retain the restored UI as unsynced and expose retry/discard through Sync Status.

## Multiple-command policy

Keep the current aggregate behavior, but store every command separately.

- Repeated item completions may show “3 items completed”.
- Undo reverses the most recent command unless the product explicitly exposes “Undo all”.
- A command removed by remote conflict is no longer eligible.
- Expiry hides the fast Undo CTA but does not erase the Activity event.

## Error copy

Do not show a successful Undo toast after an invalidation-only action.

Use:

- `Couldn’t complete Milk. Try again.`
- `Milk restored locally. Waiting to sync.`
- `Milk changed on another device. Review the latest version.`

## File-level plan

### Modify

- `src/components/SmartView.tsx`
- `src/hooks/useOptimisticMutation.ts`
- `src/hooks/useUndo.ts`
- `src/lib/commands.ts`
- `src/lib/mutation-commands.ts`
- `src/services/grocery.api.ts`
- `src/services/grocery.service.ts`

### Add

- `src/lib/grocery-cache-patches.ts`
- `src/lib/grocery-command-executor.ts`
- `src/lib/operation-result.ts`
- focused unit/integration tests beside each module.

## Acceptance criteria

- Completing an item updates the visible list and shopping progress before the request resolves.
- Deleting an item removes it immediately.
- Pressing Undo after complete sends an inverse checked-state operation and the server returns the item to its prior state.
- Pressing Undo after delete restores the exact snapshot, including quantity/category/store.
- A page refresh after successful Undo shows the restored server state.
- A failed forward mutation restores the prior cache and does not leave a misleading Undo action.
- A failed inverse is visible in the global sync state and can be retried.
- Concurrent changes return a typed conflict rather than overwriting newer data.
- The same operation ID cannot apply twice.
- Commands from household A cannot mutate or restore data in household B.

## Tests

### Unit

- command factories preserve distinct before/after snapshots;
- grouped cache helpers insert/remove/patch without mutating input;
- aggregate toast order and expiry;
- pending-forward plus requested-undo state machine;
- conflict classification.

### Integration

- optimistic complete → server success;
- optimistic complete → server failure rollback;
- optimistic delete → Undo → exact restore;
- Undo while forward request is in flight;
- offline command → Undo → reconnect reconciliation;
- duplicate operation replay is idempotent.

### Browser

- keyboard activation and focus after row removal/restore;
- shopping progress remains correct during optimistic operations;
- toast live-region copy is announced once.
