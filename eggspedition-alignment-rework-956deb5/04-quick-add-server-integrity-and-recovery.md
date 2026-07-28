# RW-004 — Quick Add Server Integrity, Identity and Recovery

**Priority:** P0  
**Maps to:** UX-003, UX-005, UX-012, UX-014  
**Primary outcome:** every accepted Quick Add tap is counted exactly once, remains repeatable under latency and cannot modify the wrong logical item.

## Verified implementation

The client-side interaction is substantially aligned:

- first tap updates local quantity;
- the one-second repeat window remains active;
- later taps restart the window;
- quantities accumulate locally;
- synchronization can batch deltas;
- a stable-key utility exists;
- the UI provides announcements.

## Discrepancies

### Name-only server matching

`addGroceryItem` resolves category/store but searches for an existing unchecked item using only `name + householdId + unchecked`. Two templates named “Milk” for different stores/categories can increment the wrong row.

### Read-modify-write increment

The service reads the current string quantity, calculates a new value, then writes it. Concurrent users or retries can lose or duplicate increments.

### Operation ID is not transmitted

The quantity-sync hook creates an operation ID, but `addGroceryItemFn` has no operation-ID field and the server stores no idempotency record.

### Retry contradiction

The accumulator announces “Tap to try again” after terminal failure, while the Quick Add button is disabled for `phase === 'failed'`.

### Standalone filtering remains name-based

Standalone Quick Add visibility derives from checked/unchecked item names. Metadata-distinct templates with the same name can hide one another.

### Unbounded animation loop

The accumulator’s `requestAnimationFrame` loop should not remain active when there are no active repeat windows. This is unnecessary continuous work on mobile.

## Domain identity

Create a shared function used by Add, Quick Add, Edit and template filtering:

```ts
interface ItemIdentityInput {
  name: string
  categoryId: string | null
  storeId: string | null
}

function createItemIdentity(input: ItemIdentityInput): string
```

Normalization:

- trim;
- Unicode NFKC;
- collapse repeated internal whitespace;
- locale-stable lowercase;
- include category/store null markers.

After an active item is resolved, use `itemId` as the primary identity.

Do not key interaction state by display name.

## API contract

Add a dedicated operation rather than overloading generic Add:

```ts
quickAddIncrementFn({
  templateId,
  delta,
  operationId,
})
```

Alternative for frequent items without a template:

```ts
quickAddIncrementFn({
  identity: { name, categoryId, storeId },
  delta,
  operationId,
})
```

Response:

```ts
{
  operationId: string
  action: 'created' | 'incremented'
  item: GroceryItem
  appliedDelta: number
}
```

## Atomicity

Store quantity as an integer if possible.

Execute the increment atomically:

```sql
UPDATE grocery_items
SET quantity = quantity + :delta,
    updated_at = NOW(),
    version = version + 1
WHERE id = :itemId
  AND household_id = :sessionHouseholdId
RETURNING *;
```

If the item does not exist, create it in the same transaction. Handle concurrent create races with a database uniqueness constraint on active item identity or a transaction-level lock.

Recommended uniqueness strategy:

- persisted normalized name column;
- partial unique index for unchecked/non-deleted items on:
  `household_id, normalized_name, category_id, store_id`.

If product semantics intentionally use name-only uniqueness, remove category/store from the client identity too. The entire system must use one rule.

## Idempotency

Add an `applied_operations` table or equivalent:

- `operation_id` unique;
- `household_id`;
- `operation_type`;
- result entity ID;
- result payload/version;
- created timestamp.

Within the increment transaction:

1. check operation ID;
2. if already applied, return stored result;
3. otherwise apply delta;
4. record operation and activity event;
5. commit.

Retries must never increment twice.

## Client state

Use stable key:

```ts
type QuickAddKey =
  | `template:${string}`
  | `item:${string}`
  | `identity:${string}`
```

On successful resolution, migrate state from template/identity key to item key without resetting the visible repeat window.

### Failure

Do not disable the failed button.

Failed state behavior:

- button remains actionable;
- quantity displays the optimistic amount with an unsynced marker;
- next tap either retries existing unsent delta or adds one and retries according to an explicit policy;
- overflow/detail exposes **Retry** and **Discard local change**;
- global Sync Status also reflects the failed operation.

Use consistent copy:

> “Milk quantity 4 is saved on this device. Couldn’t sync yet.”

### Timing

The repeat window is local UI behavior. Server synchronization may begin immediately or after a short batch delay, but the accepted-tap count must not depend on network latency.

Stop `requestAnimationFrame` when no item has an active deadline. Restart only when an interaction enters active/disappearing state. A timeout per nearest deadline is also acceptable and usually cheaper.

## Template visibility

Determine whether a standalone Quick Add template is already active using:

1. resolved active item ID when available;
2. otherwise full normalized identity.

Do not build a `Set<string>` of names.

The standalone chip disappears only when its matching logical item is active and the repeat window has expired.

## Server authorization

Every template and active item lookup must include the authenticated household. A template ID from another household returns not found without revealing existence.

## File-level plan

### Modify

- `src/components/QuickAdd.tsx`
- `src/hooks/useQuickAddAccumulator.ts`
- `src/hooks/useQuickAddQuantitySync.ts`
- `src/services/grocery.api.ts`
- `src/services/grocery.service.ts`
- `src/lib/schemas.ts`
- database schema/migrations.

### Add

- `src/lib/item-identity.ts`
- `src/services/operation.service.ts`
- concurrency/idempotency integration tests.

## Acceptance criteria

- Ten rapid taps always produce exactly quantity 10 from zero, regardless of response order.
- Retrying the same operation ID does not change quantity twice.
- Two users incrementing concurrently do not lose deltas.
- “Milk · Lidl” and “Milk · Carrefour” update separate items.
- Terminal failure does not disable the advertised retry interaction.
- Standalone filtering uses logical identity, not name.
- The repeat window remains responsive at 2G/slow-network simulation.
- No continuous animation loop runs while Quick Add is idle.
- Foreign-household template IDs cannot be read or incremented.
- Every applied burst creates one coherent activity event containing the delta and resulting quantity.

## Tests

- identity normalization;
- metadata-distinct same-name templates;
- 20-tap local accumulator;
- concurrent increments in database transaction tests;
- duplicate operation replay;
- server failure → retry;
- offline queued burst → reconnect;
- animation scheduler starts/stops;
- state key migration from template to item;
- authorization by household.
