# RW-010 — Quick Add Template Manager Semantics and Generation Policy

**Priority:** P1  
**Maps to:** UX-010, UX-003, UX-004, UX-013  
**Primary outcome:** template management is valid, keyboard-accessible and consistent with a deliberate Quick Add generation policy.

## Verified implementation

The revision improves this area substantially:

- mobile cards replace the table at narrow widths;
- desktop retains a table;
- create/edit uses an adaptive sheet/dialog;
- category and store metadata can be edited;
- menu actions and delete behavior exist;
- loading and empty states exist.

## Discrepancies

### Invalid nested interaction

Each mobile template is rendered as a `<button>` containing another menu `<button>`. Nested interactive controls are invalid HTML and create inconsistent click, focus and assistive-technology behavior.

### Misleading retry copy

Load failure says “Pull down to retry,” but no pull-to-refresh implementation is connected. There is no explicit Retry button.

### Undo is registered before delete success

The editor pushes a delete Undo command before calling the mutation. If deletion fails, the interface may still offer to undo an operation that never completed.

### Delete rollback recreates by names

Rollback calls Add Template with name/categoryName/storeName. It may create a new ID, duplicate a concurrently created template or lose other fields/order.

### Template generation policy conflicts with UI

The grocery service auto-creates a permanent Quick Add template for every newly added grocery item. This undermines the intended distinction between curated templates and recent/frequent suggestions and can cause uncontrolled template growth.

### Type safety gaps

Category/store lookups and form values use `any` casts even though typed entities are available.

### Dialog behavior

The template editor implements basic modal semantics but does not show mutation errors, does not clearly trap/restore focus and uses globally fixed IDs.

## Product decision

Treat Quick Add content as two sources:

1. **Pinned templates** — explicitly managed by the household.
2. **Suggestions** — derived from frequency/recency and not persisted as templates until pinned.

Do not auto-create a permanent template on every grocery add.

## Mobile card structure

Use a non-interactive container:

```tsx
<li className={styles.card}>
  <button className={styles.cardMain} onClick={openEdit}>…</button>
  <button className={styles.menuButton} aria-haspopup="menu">…</button>
</li>
```

Alternative: entire card is a `div` with a labeled Edit button and menu button.

Requirements:

- no interactive descendant inside another interactive element;
- main action and menu are separate tab stops;
- menu click does not trigger edit;
- 44×44 targets;
- focus ring is visible independently.

## Template model

```ts
interface QuickAddTemplate {
  id: string
  householdId: string
  name: string
  normalizedName: string
  categoryId: string | null
  storeId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  version: number
}
```

Enforce household-scoped logical uniqueness or explicitly allow duplicates by metadata using the shared identity rule.

## Suggestion model

```ts
interface QuickAddSuggestion {
  identity: ItemIdentity
  score: number
  lastUsedAt: string
  useCount: number
}
```

Suggested section actions:

- tap to add;
- pin as template;
- dismiss suggestion if desired.

Adding a grocery item updates frequency data, not the template table.

Migration strategy:

- preserve all current templates as pinned;
- stop future auto-creation;
- optionally deduplicate existing exact identities;
- do not silently delete household-curated entries.

## Create/edit form

- unique IDs via `useId`;
- controlled category/store selection without `any`;
- visible save/delete errors;
- Retry retains draft;
- focus trap and trigger restoration;
- Escape behavior;
- version/expectedVersion for conflicts;
- duplicate identity warning.

Save response returns canonical template.

## Delete and Undo

Use RW-001 command principles.

Preferred:

- soft delete template or exact restore endpoint;
- optimistic removal;
- Undo registered from the before snapshot;
- server inverse restores same ID/order where possible;
- failed delete rolls back and removes misleading Undo.

Do not recreate through generic Add by display names.

## Ordering

Use product-owned order:

- pinned template `sortOrder`;
- drag reorder only if accessible alternative buttons exist;
- otherwise Move up/down menu commands;
- alphabetical order may be a fallback, not the only persisted model.

Quick Add display should use the same order across mobile/desktop.

## Error states

Replace unsupported copy with:

> `Couldn’t load Quick Add templates.`  
> **Try again**

For background failure, retain cached cards and show a compact retry banner.

Mutation errors are action-level:

- `Couldn’t save Milk. Try again.`
- `Couldn’t delete Milk.`

## File-level plan

### Modify

- `src/components/AdminDashboard.tsx`
- `src/components/TemplateEditor.tsx`
- corresponding CSS modules;
- `src/components/QuickAdd.tsx`
- `src/services/grocery.service.ts`
- Quick Add API/service/schema.

### Rename recommended

- `AdminDashboard` → `QuickAddTemplateManager`
- `/admin` remains compatibility redirect only.

### Add

- suggestion service/query;
- sort-order operations;
- exact template restore operation;
- template migration.

## Accessibility

- valid DOM with separate buttons;
- menu follows WAI-ARIA menu behavior or uses simpler visible actions;
- editor has unique label IDs;
- form errors are connected to fields/summary;
- focus returns to source card after close;
- after delete, focus moves to neighboring card;
- reorder has keyboard controls and announcements.

## Acceptance criteria

- HTML validation reports no nested interactive elements.
- Main card and menu actions operate independently.
- Load error exposes a real Retry action.
- Failed deletion cannot leave a false Undo toast.
- Undo restores exact template identity and order.
- Adding a normal grocery item does not automatically create a pinned template.
- Suggestions remain available through derived frequent/recent data.
- No `any` casts are needed for category/store/template entities.
- Editor errors preserve draft and are visible.
- Duplicate template identity is handled deliberately.
- Mobile and desktop ordering match.

## Tests

- click/menu event propagation;
- keyboard card/menu flow;
- error Retry;
- delete success/failure/Undo;
- exact restore ID/order;
- no auto-template creation;
- suggestion scoring/pinning;
- duplicate identity;
- focus trap/restore;
- HTML/accessibility audit.
