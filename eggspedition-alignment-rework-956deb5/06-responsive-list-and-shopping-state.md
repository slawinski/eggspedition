# RW-006 — Responsive List Layout and Shopping-State Contract

**Priority:** P1  
**Maps to:** UX-006, UX-007, UX-013  
**Primary outcome:** list layout responds through CSS without JavaScript redistribution, while shopping mode has predictable URL/history, store validation and persisted preferences.

## Verified implementation

The revision includes:

- planning and shopping modes;
- store selection;
- remembered last store;
- store progress;
- completed item section;
- responsive-looking multiple columns;
- loading skeletons.

## Discrepancies

### JavaScript controls layout

`SmartView` listens to `window.resize`, calculates 1/2/3 columns and distributes groups into arrays. This is exactly the breakpoint-driven rendering UX-007 intended to remove.

Consequences:

- hydration/layout mismatch risk;
- content reshuffling during resize;
- focus and reading order can diverge from visual order;
- unnecessary React renders;
- no response to container width independent of viewport.

### Browser Back does not exit shopping naturally

Shopping URL changes use `replace: true`. Entering shopping mode does not create a history entry, so browser Back cannot serve as the expected exit interaction.

### Search types are bypassed

Navigation uses `as any` and loosely typed records. Invalid mode/store combinations can reach components.

### Store validation

A store ID from a deep link is not normalized against the household store list before mode rendering.

### Planning preference

The group-by category/store preference is local component state and resets on remount. Only last shopping store is persisted.

### Error handling

The primary grouped query returns `null` on missing data and does not expose a dedicated retry state. Delete errors in shopping mode lack Retry.

## Product decision

### Layout

Keep one DOM order. Let CSS place group cards.

Recommended:

```css
.groupGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  align-items: start;
  gap: var(--space-4);
}
```

Use container queries if the list sits within a variable-width application shell. Do not create artificial column arrays in React.

If true masonry is essential, use CSS masonry only behind progressive enhancement; source order remains authoritative.

### Shopping URL

Use typed search state:

```ts
mode?: 'shopping'
store?: 'all' | UUID
group?: 'category' | 'store'
```

Entering shopping mode in-app pushes history. Exiting via Back returns to planning. Explicit **Done/Exit** can replace or navigate back depending on overlay-state provenance.

## Required layout changes

Remove:

- `columnCount`;
- resize listener;
- `window.innerWidth`;
- group distribution loops;
- column-specific skeleton generation.

Render:

```tsx
<div className={styles.groupGrid}>
  {groups.map(group => <GroupCard key={group.id} ... />)}
</div>
```

### Ordering

Define one deterministic source order:

1. assigned groups in user/product order;
2. unassigned group last;
3. active items before completed where applicable.

Visual layout must not alter screen-reader/tab order.

### Loading stability

Render a responsive grid of generic cards without pre-deciding “three columns” in JavaScript. Use CSS aspect/min-height to reduce shifting.

## Shopping state resolver

Create a pure resolver:

```ts
resolveShoppingState({
  search,
  stores,
  itemsByStore,
  rememberedStoreId,
}): ResolvedShoppingState
```

Rules:

- `mode` absent → planning;
- `mode=shopping&store=<valid>` → scoped shopping;
- `mode=shopping&store=all` → all-store shopping;
- missing store with one eligible store → select that store;
- missing store with multiple stores → store picker;
- invalid/foreign store → replace URL with a valid fallback and show “That store is no longer available”;
- no active items → planning with empty-state guidance.

Do not let component-local mode and URL mode drift. The URL is the canonical navigation state; ephemeral animation state may remain local.

## Preference persistence

Household-scoped settings:

```ts
eggspedition:list-group:<householdId>
eggspedition:last-shopping-store:<householdId>
```

Persist group preference on change. Validate stored values on read.

If users collaborate across devices and preference should follow the account, move it server-side later; local storage is acceptable for the current scope.

## Shopping behavior refinements

- `onChangeStore` must be wired to an actual control and covered by tests.
- Progress uses optimistic data from RW-001.
- Completed section can collapse but remains reversible.
- Delete error offers Retry.
- Background query failure retains cached shopping list.
- Offline mode communicates queued completion using RW-005.
- Store picker shows item count and excludes stores with zero active items unless “show all stores” is intentional.

## Accessibility

- Group switcher uses a radiogroup or tabs with explicit selected state.
- Shopping progress has a text equivalent.
- Store picker is a dialog/listbox or a page with correct heading structure.
- Layout resizing never moves focus.
- Completed section toggle exposes `aria-expanded` and controlled region ID.
- The “Exit shopping” action is a real button, not only browser behavior.

## File-level plan

### Modify

- `src/components/SmartView.tsx`
- `src/components/SmartView.module.css`
- `src/components/ShoppingMode.tsx`
- `src/components/StorePicker.tsx`
- `src/routes/index.tsx`
- root/index search schemas.

### Add

- `src/lib/resolve-shopping-state.ts`
- `src/hooks/useHouseholdPreference.ts`

## Acceptance criteria

- No runtime code reads `window.innerWidth` to determine list columns.
- One semantic DOM order is used at all widths.
- Layout responds to container width through CSS.
- Entering shopping mode creates a Back destination.
- Browser Back exits shopping mode after in-app entry.
- Direct shopping links close safely without leaving the app unexpectedly.
- Invalid store IDs are normalized and never show an empty “valid” store.
- Group-by preference survives reload for the same household.
- Preferences do not leak across households.
- Loading and error states preserve layout stability.
- Shopping delete error includes Retry.
- No `as any` is needed for route navigation or grouped item iteration.

## Tests

- pure shopping resolver matrix;
- direct link vs in-app entry history;
- invalid/removed/foreign store;
- one/multiple/no eligible stores;
- group preference persistence/isolation;
- source order at mobile/desktop;
- container resize without React state changes;
- keyboard group/store controls;
- cached data with background error.
