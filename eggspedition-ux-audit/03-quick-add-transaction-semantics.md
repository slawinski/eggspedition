# UX-003 — Quick Add Repeat-to-Increment Interaction

**Priority:** P1  
**Primary outcome:** preserve the fast “tap again to add more” behavior while making quantity, timing and pending states immediately understandable and reliable under slow networks.

## Correction to the original audit

The one-second countdown is **not** intended as an undo or delayed-commit period.

In standalone mode, Quick Add behaves as a temporary repeat-to-increment window:

1. the first tap immediately adds the item;
2. the item would normally disappear because it is now present on the active list;
3. the settling state keeps the Quick Add button visible for one second;
4. another tap adds one more unit and restarts the one-second window;
5. when the user stops tapping, the button completes its animation and disappears.

This is a useful rapid-entry interaction and should be retained.

## Current implementation

`QuickAdd.tsx` currently:

- calls `mutation.mutate()` on every accepted tap;
- keeps standalone items visible through `settling` and `disappearing` state;
- resets `lastUpdated` whenever the item is tapped again;
- prevents another tap while that item name is in `pendingNames`;
- removes the item after the one-second repeat window and exit animation;
- always keeps items visible in sheet mode and shows the active quantity there.

The original audit incorrectly described the timer as a misleading cancellation or settling period. Its actual purpose is to expose a short increment opportunity.

## Problems worth fixing

### 1. The repeat action is not explicitly communicated

A shrinking fill can be interpreted as:

- waiting for the add to finish;
- time remaining to cancel;
- progress toward completion;
- time remaining before the control disappears.

Only the last interpretation is correct. The UI should communicate that the item was already added and that tapping again adds another unit.

### 2. Repeat speed depends on network latency

The affected button is disabled while `pendingNames` contains its name. A second tap is therefore accepted only after the previous mutation succeeds.

Consequences:

- on a fast connection, the user can tap several times during the one-second window;
- on a slow connection, most or all of that window may be spent disabled;
- visible timing and actual interaction availability can diverge;
- rapid taps can be silently ignored because the HTML button is disabled.

The repeat window should be governed by local interaction state, not round-trip time.

### 3. State is keyed by item name

`settling`, `disappearing` and `pendingNames` use `item.name` as identity. Two templates with the same name but different category or store metadata can share interaction state incorrectly.

### 4. Quantity feedback is too indirect

The quantity badge appears only after cached grocery data reflects the mutation. On a slow request, the user may see a timer without an immediate numerical confirmation that the tap counted.

### 5. One request per tap can create avoidable contention

Every accepted tap starts another add mutation. This can produce out-of-order responses, redundant invalidations and unnecessary server load unless requests are serialized or accumulated deliberately.

## Product decision

Keep Quick Add as an immediate, repeatable quantity shortcut:

- item absent → create it with quantity `1`;
- item already active → increase its quantity by `1`;
- each accepted tap updates the displayed quantity immediately;
- each accepted tap restarts the short repeat window;
- when the window expires, the standalone chip leaves the Quick Add collection because the item is now active on the list;
- no countdown-based cancellation behavior is introduced.

The user-visible contract is: **each tap counts immediately**.

## Recommended interaction design

### Default state

Show:

- plus icon;
- item name;
- optional category/store metadata when needed for disambiguation;
- minimum 44 px touch height.

Accessible name example:

> Add Milk to the list

### First tap

Immediately:

- optimistically add one unit;
- replace the plus icon with a compact quantity confirmation such as `×1` or `1`;
- start the one-second repeat window;
- keep the button fully tappable;
- announce “Milk added. Quantity 1.” through a polite live region.

### Repeated tap

Immediately:

- increment the local displayed quantity;
- restart the repeat-window timer;
- provide a restrained pressed response;
- announce only the new quantity, for example “Milk quantity 3.”

Do not replace the control with a permanent checkmark while it remains actionable. A checkmark conventionally communicates completion, while the desired action is “tap again.”

### Window expiration

When no tap has occurred for one second:

- finalize the interaction batch;
- briefly stabilize the final quantity;
- animate the standalone item out;
- move keyboard focus predictably if the activated control disappears;
- do not remove the item from sheet mode, where Quick Add remains a reusable quantity control.

### Visual timer

The timer may remain, but its meaning should be clearer:

- treat it as the remaining **repeat window**, not mutation progress;
- pair it with immediate quantity feedback;
- use a subtle edge/fill treatment that does not resemble upload progress;
- restart it visibly after each accepted tap;
- disable or simplify the animation under `prefers-reduced-motion` without changing the one-second interaction window.

A small temporary hint such as “Tap again for more” may appear after the first-ever use, but should not be shown on every interaction.

## Quantity model

Define a single domain operation:

```ts
quickAddIncrement({ templateId, itemIdentity, amount: 1 })
```

The operation should return:

- whether an active item was created or incremented;
- the stable grocery item ID;
- the resulting confirmed quantity;
- a client operation ID used for reconciliation.

Never create duplicate active rows for repeated taps on the same resolved item identity.

## Identity and matching

Use a stable key in this order:

1. active grocery item ID, once resolved;
2. Quick Add template ID;
3. normalized tuple of `name + categoryId + storeId` for frequent items without a template ID.

Name alone is not sufficient when store or category distinguishes otherwise similar items.

Normalization should include trimming, Unicode normalization and locale-safe case folding.

## Concurrency strategy

### Recommended: optimistic accumulator with a per-item queue

Maintain local state per stable item key:

```ts
interface QuickAddInteractionState {
  optimisticQuantity: number
  confirmedQuantity: number
  unsentDelta: number
  inFlightDelta: number
  repeatWindowEndsAt: number
  phase: 'idle' | 'active' | 'syncing' | 'failed'
}
```

On every tap:

1. increment `optimisticQuantity` immediately;
2. increment `unsentDelta`;
3. restart `repeatWindowEndsAt`;
4. schedule or continue synchronization without disabling the button.

For server synchronization, choose one of these compatible implementations:

- **serialized increments:** send one increment at a time per item and preserve later taps in a local queue;
- **batched delta:** debounce briefly and send the accumulated quantity delta in one request when the burst pauses.

Batched delta is preferable if the API can support an atomic increment operation. Avoid read-modify-write updates that can lose increments from another household member.

### Required server property

Quantity changes should use an atomic increment command where possible:

```ts
incrementGroceryItemQuantity({ itemId, delta, operationId })
```

The operation should be idempotent for a given `operationId` so retries do not add the quantity twice.

## Failure behavior

A failed request must not erase later accepted taps.

When synchronization fails:

- keep the final optimistic quantity visible where practical;
- mark the operation as unsynced;
- retry according to UX-012;
- show a concise message such as “Milk quantity hasn’t synced yet”; 
- provide Retry when automatic retry is exhausted;
- reconcile against the server without creating duplicate rows.

When offline queuing is supported, every tap should still count locally and synchronize later.

## Undo relationship

The repeat window itself is not an Undo window.

Undo, when implemented through UX-004, should operate on the completed interaction batch:

- three taps during one burst can produce “Milk quantity increased by 3”; 
- Undo restores the quantity that existed before that burst;
- the Undo toast must not interfere with continued tapping inside the repeat window.

This keeps the rapid-add gesture simple while still allowing recovery from an accidental burst.

## Sheet-mode behavior

Sheet mode should use the same optimistic quantity engine, but the item should remain visible after the repeat window.

Recommended control states:

- absent: `+ Milk`;
- active: `Milk · 2` or `Milk ×2`;
- during a tap burst: quantity updates immediately;
- syncing: subtle non-blocking indicator;
- failed/offline: visible but still usable queued state where supported.

Do not maintain two independent Quick Add mutation models for standalone and sheet variants.

## Engineering plan

1. Replace name-keyed records with a stable `quickAddKey`.
2. Extract a reusable `useQuickAddAccumulator()` hook or domain controller.
3. Separate interaction timing from network pending state.
4. Stop disabling a chip merely because its previous increment is in flight.
5. Optimistically update the quantity badge on every accepted tap.
6. Serialize or batch writes per grocery-item identity.
7. use atomic, idempotent increment operations on the server.
8. Retain the standalone repeat-window/disappear behavior.
9. Share the same quantity and synchronization logic between standalone and sheet variants.
10. Add live-region announcements that do not become excessively noisy during rapid tapping.

## Acceptance criteria

- The first tap adds quantity `1` immediately.
- Every subsequent accepted tap increases the visible quantity immediately.
- Every tap restarts the one-second repeat window.
- The control remains tappable while earlier increments are in flight.
- Slow network latency does not reduce the number of taps the user can enter during the repeat window.
- When the user stops tapping, the standalone chip disappears after the repeat window.
- The sheet variant remains visible and shows the resulting quantity.
- Two templates with identical names but different IDs or metadata do not share interaction state.
- Failed or retried requests cannot double-apply or lose an accepted increment.
- Another household member changing the same quantity does not cause a destructive last-write-wins overwrite.
- Screen readers receive meaningful quantity updates without hearing the full control label on every animation frame.
- Reduced-motion mode retains identical timing and functionality without the continuous progress animation.

## Tests

### Domain tests

- absent item becomes quantity `1`;
- existing item increments rather than duplicating;
- five rapid taps produce a delta of `5`;
- queued taps are retained while an earlier request is in flight;
- retry with the same operation ID is idempotent;
- concurrent remote increment reconciles correctly;
- same name/different template identity stays independent.

### Component tests

- first tap starts the repeat window;
- repeat tap resets the window;
- quantity changes synchronously in the UI;
- button remains enabled during network pending state;
- standalone chip exits only after inactivity;
- sheet chip remains present;
- failure and offline states remain understandable;
- focus is not lost unexpectedly when a chip disappears;
- reduced-motion behavior.

### End-to-end tests

- rapid tapping under artificial 2–3 second latency;
- temporary offline mode followed by reconnect;
- two clients incrementing the same item concurrently;
- repeated server retry without duplicated quantity.

## Non-goals

- Turning the countdown into cancellation.
- Delaying visible quantity changes until the server responds.
- Removing the repeat-to-increment interaction.
- Treating the one-second window as a substitute for transactional Undo.
- Predictive or automatic replenishment.
