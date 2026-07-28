# UX-005 — Item Editing and Quantity Management

**Priority:** P0  
**Primary outcome:** users can correct an item after adding it without deleting and recreating it.

## Problem

The active list displays name, quantity and contextual metadata, but does not provide a complete edit flow. Quantity is rendered as a badge and the visible row actions are completion and deletion. A typo, incorrect store, wrong category or quantity change therefore creates unnecessary destructive work.

This also weakens Quick Add: incrementing quantity is useful only if users can later decrease or directly correct it.

## Entry points

Open the item editor when the user:

- taps/clicks the item body or name;
- chooses **Edit** from the row overflow menu;
- activates the row with Enter when it has focus.

Completion remains a separate checkbox action.

## Presentation

- Mobile: bottom sheet using the same adaptive dialog foundation as the Add composer.
- Desktop: centered dialog or anchored side panel; prefer a centered dialog initially for consistency.
- Title: **Edit item**.
- Primary CTA: **Save changes**.
- Secondary actions: Cancel and Delete item.

## Fields

### Item name

- Required.
- Preserve user casing.
- Validate uniqueness through the same normalized identity rules as Quick Add.
- If editing would collide with an existing active item, offer **Merge items** rather than silently creating duplicates.

### Quantity

- Large stepper with minus and plus controls.
- Direct numeric input available.
- Minimum value 1.
- Holding plus/minus may repeat on pointer devices, but must stop on pointer-up/cancel.
- Do not use quantity zero as an implicit delete operation.

### Category and store

- Reuse accessible combobox controls from UX-002.
- Allow clearing either field.
- Show recently used values first.
- Creating a new category/store is explicit.

## Save behavior

- Disable Save only when values are invalid or no changes exist.
- Optimistically update the row and move it to the correct group when category/store changes.
- If group changes, animate position subtly; do not make the item disappear without a status message.
- Toast examples:
  - “Milk updated.”
  - “Milk moved to Lidl.”
- On failure, rollback and keep the editor open with entered values plus Retry.

## Merge behavior

When edited identity matches another active item:

Dialog/message:

**Milk is already on the list.**  
“Merge quantities and keep the selected category and store?”

Actions:

- **Merge** — sum quantities and remove the redundant item as one reversible command;
- **Keep separate** — only when metadata makes separate entries meaningful;
- Cancel.

The default should not be a silent merge.

## Delete behavior

Place **Delete item** at the bottom of the editor, visually separated from Save. Use the universal undo system from UX-004 rather than an immediate permanent action.

## Optional fast quantity controls

After the editor is stable, consider revealing compact `− / +` controls directly in the row when quantity is above one or when the row is expanded. Do not add them if they make the normal row crowded. The editor remains the guaranteed path.

## Data and API changes

Prefer one typed update operation:

`updateGroceryItem({ id, patch: { name?, quantity?, categoryId?, storeId? } })`

Requirements:

- partial updates validated by Zod;
- optimistic version or `updatedAt` conflict detection;
- normalized identity validation server-side;
- merge operation handled atomically by the server;
- activity log records meaningful changes without leaking internal IDs.

## Concurrent-edit behavior

If another member edits or completes the same item while the editor is open:

- detect stale version on save;
- show “This item changed while you were editing”;
- display current server values and user-entered values;
- offer **Use my changes** or **Reload current item** where safe;
- never silently overwrite a remote delete.

For MVP, an explicit stale-version error is sufficient; a complex field-by-field merge is not required.

## Accessibility

- Dialog has a labelled title and description.
- Initial focus goes to item name only on desktop; on mobile consider focusing the sheet title to avoid automatically opening the keyboard.
- Quantity controls announce the resulting value.
- Category/store options are keyboard accessible.
- Delete is clearly named with the item: “Delete Milk.”
- Save errors are linked to their fields and announced.

## Acceptance criteria

- User can edit name, quantity, category and store.
- Updating category/store relocates the row optimistically to the correct group.
- Quantity can be increased and decreased without deleting the item.
- Identity collisions invoke an explicit merge decision.
- Delete is available but secondary and undoable.
- Failed saves keep the user’s values and show Retry.
- Stale concurrent edits are detected rather than silently overwritten.

## Tests

- field validation and unchanged-state Save;
- quantity boundaries and direct entry;
- group relocation cache updates;
- merge transaction and undo;
- failure rollback while editor remains open;
- concurrent version conflict;
- keyboard/focus behavior on mobile and desktop.

## Non-goals

- Price tracking.
- Measurement units.
- Item photos or notes.
