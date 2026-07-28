# RW-002 — Item Editor, Quantity Semantics and Conflict Handling

**Priority:** P0  
**Maps to:** UX-005, UX-004, UX-006  
**Primary outcome:** every grocery item can be safely edited without duplicate creation, metadata loss or last-write-wins surprises.

## Verified implementation

- `ItemRow` exposes an edit interaction.
- `SmartView` passes `handleEdit`.
- `updateGroceryItemFn` accepts name, quantity, category, store and checked changes.
- Category and store data are already available in `SmartView`.

## Discrepancy

`SmartView.handleEdit` remains an explicit placeholder. No item editor is opened, no edit state is represented in the URL, and no merge/conflict policy is implemented.

The update service also performs an unrestricted partial update by item ID. It does not enforce household scope or version checks.

## Product decision

Use one adaptive item editor for planning and shopping contexts.

- Mobile: bottom sheet.
- Wider screens: centered dialog.
- Open by tapping the item body or choosing **Edit** from the overflow menu.
- Keep checkbox and destructive action outside the editor’s primary save path.
- Persist the editor target in search state: `?edit=<itemId>`.
- Browser Back closes the editor when it was opened in-app.

## Fields

### Name

- Required.
- Trim outer whitespace.
- Preserve user casing for display.
- Normalize separately for identity matching.
- Maximum length should be defined in the shared schema, recommended 120 characters.

### Quantity

Represent quantity as a positive integer in the UI and database unless fractional quantities are an explicit product requirement.

Controls:

- decrement button;
- numeric input;
- increment button.

Rules:

- minimum `1`;
- maximum defined by schema, recommended `999`;
- invalid input remains editable but prevents Save;
- quantity controls have explicit accessible names.

### Category and store

Use the same controlled pickers as Add Item.

- Existing values are preselected.
- A clear action sets the field to `null`.
- Creating a new category/store is explicit and confirmed.
- Never overwrite metadata merely because the user changed only the name.

## Save state machine

```ts
type EditorState =
  | { phase: 'closed' }
  | { phase: 'editing'; original: GroceryItem; draft: ItemDraft }
  | { phase: 'saving'; original: GroceryItem; draft: ItemDraft }
  | { phase: 'conflict'; original: GroceryItem; draft: ItemDraft; remote: GroceryItem }
  | { phase: 'failed'; original: GroceryItem; draft: ItemDraft; error: MutationError }
```

Save must:

1. calculate a field-level diff;
2. submit only changed fields plus `expectedVersion`;
3. optimistically patch the row;
4. close only after local acceptance;
5. expose Undo using RW-001;
6. restore the draft if synchronization fails.

## Identity and merge behavior

Before saving a name/category/store change, resolve whether another unchecked item already has the same normalized identity.

Identity:

```ts
normalizedName + categoryId/null + storeId/null
```

If no match exists, update normally.

If a match exists, do not silently merge. Present a confirmation:

> “Milk already exists in Dairy · Lidl. Merge quantities?”

Actions:

- **Merge** — add edited quantity to the target, delete/soft-delete the source, preserve a reversible event;
- **Keep separate** — allowed only when the identities can remain distinct;
- **Cancel**.

If the product wants name-only uniqueness instead, encode that as a single server rule and show it consistently in Add, Quick Add and Edit. Do not let each surface decide differently.

## Concurrent editing

Add an integer `version` column or equivalent updated-at compare token.

Server update contract:

```ts
updateGroceryItem({
  itemId,
  changes,
  expectedVersion,
  operationId,
})
```

When the expected version is stale:

- return `{ code: 'VERSION_CONFLICT', currentItem }`;
- keep the user’s draft;
- show field differences;
- offer **Use latest**, **Apply my changes**, or a field-level merge where safe.

“Apply my changes” sends the latest version as the new expectation. It must be a deliberate second action.

## Delete from editor

Delete is visually separated at the bottom.

- Button label includes item name.
- First activation opens a compact confirmation only if accidental deletion risk is high; otherwise rely on reliable Undo.
- Close the editor after local deletion.
- Restore focus to a logical neighboring row if the edited row disappears.
- Use the exact snapshot/inverse contract from RW-001.

## URL contract

Root search schema:

```ts
edit?: string // UUID
```

Behavior:

- valid active item ID opens editor;
- valid completed item ID can open a read/edit view if product permits;
- invalid or foreign ID removes `edit` with `replace: true` and shows a non-blocking message;
- closing removes only `edit`;
- opening in-app pushes history;
- direct-link closing replaces the URL rather than leaving the app.

## Architecture

### Add

- `src/components/EditItemSheet.tsx`
- `src/components/ItemEditorForm.tsx`
- `src/hooks/useItemEditor.ts`
- `src/lib/item-identity.ts`
- `src/lib/item-diff.ts`

### Modify

- `src/routes/__root.tsx`
- `src/components/SmartView.tsx`
- `src/components/ItemRow.tsx`
- `src/components/ShoppingMode.tsx`
- `src/services/grocery.api.ts`
- `src/services/grocery.service.ts`
- shared Zod schemas.

Do not duplicate form logic between Add and Edit. Extract reusable field components while keeping submission semantics separate.

## Accessibility

- Dialog uses `aria-modal="true"` and a unique heading ID.
- Focus enters the name field or dialog heading.
- Focus is trapped while modal.
- Escape closes unless a destructive confirmation is open.
- On close, focus returns to the originating row/action.
- Validation errors use `aria-describedby` and focus the first invalid field.
- Increment/decrement controls meet 44×44 CSS pixel target size.
- Do not nest buttons or place the entire row button around other controls.

## Acceptance criteria

- Every visible item can open a populated editor.
- Editing only quantity does not alter category/store.
- Clearing category or store persists `null`.
- Save updates the row optimistically and is undoable.
- Refreshing after save shows the canonical server values.
- An invalid quantity cannot be submitted.
- Editing into an existing identity never silently merges.
- A stale edit returns a conflict UI and preserves the local draft.
- Direct `?edit=<id>` links open the correct editor for authorized household members.
- Foreign household item IDs cannot be read or mutated.
- Closing with browser Back works when opened in-app.
- No duplicate form IDs exist when Add and Edit surfaces are mounted.

## Tests

- field diff creation;
- identity normalization and collision detection;
- quantity boundaries;
- metadata clearing;
- merge transaction and inverse;
- stale-version conflict;
- optimistic update rollback;
- route opening/closing and invalid ID cleanup;
- focus entry/restore;
- keyboard-only form completion.
