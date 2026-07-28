# RW-003 — Add Composer Contract, URL Cleanup and Accessibility

**Priority:** P1  
**Maps to:** UX-002, UX-013, UX-014  
**Primary outcome:** the Add flow has one unambiguous active composer, valid document IDs, predictable browser history and an accessible suggestion interaction.

## Verified implementation

The current revision successfully adds:

- a root-level `AddItemSheet`;
- `?add=item` state;
- deep-link fields for name, quantity, category and store;
- an Add form used in both sheet and inline contexts;
- parsing and suggestions;
- a floating Add trigger;
- focus and dialog scaffolding.

## Discrepancies

### Competing composers

The home route still renders an inline `AddItemForm` while the root can simultaneously mount the sheet. On desktop this can expose two add workflows at once and duplicate form controls.

### Duplicate IDs

`AddItemForm` uses fixed IDs such as `add-item-name`. Rendering inline and sheet instances creates duplicate document IDs and incorrect label associations.

### Incomplete URL cleanup

Closing the sheet removes `add` but leaves `name`, `quantity`, `category` and `store`. The stale data can unexpectedly repopulate a later Add action and prevents a clean shareable URL.

### Suggestion semantics

The current suggestions are buttons beneath an input, not a complete combobox/listbox interaction. Keyboard active-option semantics, `aria-activedescendant`, option selection and announcement are incomplete.

### Existing-item ambiguity

The server may increment an existing item with the same name, but the composer does not clearly state whether submission will create or increment. The user cannot review the resolved target.

### Error recovery

The form keeps an error message but does not provide a first-class Retry action tied to the same draft and operation ID.

### Unsupported drag affordance

The sheet renders a visual handle although drag-to-dismiss is not implemented. This advertises a gesture that does nothing.

## Product decision

The sheet is the primary add experience on all authenticated screen sizes.

Recommended behavior:

- Mobile: bottom sheet.
- Desktop/tablet: compact dialog or anchored command panel.
- Home may show a lightweight launcher/search affordance, but not a second complete form.
- Only one Add form instance is mounted at a time.
- Deep-link state is owned by the route and cleared as one unit.

## Route contract

Define a dedicated schema:

```ts
const addSearchSchema = z.object({
  add: z.literal('item').optional(),
  name: z.string().max(120).optional(),
  quantity: z.coerce.number().int().min(1).max(999).optional(),
  category: z.string().uuid().optional(),
  store: z.string().uuid().optional(),
})
```

### Opening

In-app:

- push a history entry;
- preserve unrelated route/search state;
- set `add=item`.

Direct link:

- validate all values;
- ignore invalid optional metadata rather than crashing;
- show a clear correction if required data is invalid.

### Closing

Remove the full Add namespace:

- `add`
- `name`
- `quantity`
- `category`
- `store`

Use browser Back only when the sheet was opened by the app and the current history entry belongs to the Add action. Do not rely on `window.history.length` alone.

Prefer a route-state marker containing an action instance ID:

```ts
{ overlay: { type: 'add-item', id: crypto.randomUUID() } }
```

## Component identity

Use React `useId()` or an explicit `idPrefix` prop:

```tsx
const nameId = `${idPrefix}-name`
```

Every form instance must have unique IDs for:

- name;
- quantity;
- category;
- store;
- help text;
- error text;
- suggestion list;
- active option.

A test should render two instances defensively and assert no duplicate IDs even though product code should mount only one.

## Accessible combobox behavior

For the item name field:

- wrapper/input follows ARIA combobox pattern;
- `aria-expanded` reflects suggestion visibility;
- `aria-controls` points to the listbox;
- `aria-activedescendant` points to the highlighted option;
- suggestions use `role="option"`;
- Up/Down changes the active option;
- Enter selects active option;
- Escape closes suggestions before closing the sheet;
- Tab leaves the combobox naturally;
- pointer selection does not steal focus before value commit.

Each suggestion communicates its action:

- `Milk — increase quantity to 3`
- `Milk — Quick Add template`
- `Create “Milk”`

Resolve suggestions from:

1. active grocery items;
2. Quick Add templates;
3. recent/frequent items;
4. create-new fallback.

## Submission semantics

Before submit, display the resolved action:

- **Add new item**
- **Increase Milk from 2 to 3**

The API response should return:

```ts
{
  action: 'created' | 'incremented',
  item: GroceryItem,
  operationId: string
}
```

Use the shared identity rule from RW-004. The UI must not promise “new item” if the server will increment an existing row.

## Form behavior

- Keep draft values while request is pending or failed.
- Disable only the final submit action, not unrelated controls.
- Prevent duplicate submission using the same operation ID.
- On failure, show **Try again** and **Edit details**.
- On success, announce the resulting quantity.
- Keep sheet open for rapid multi-item entry only if the product intentionally supports a continuous-entry mode; otherwise close and restore focus.
- Input font size must remain at least 16 CSS pixels on iOS.

## Sheet behavior

Choose one:

1. implement drag-to-dismiss with threshold, velocity, scroll coordination and reduced-motion support; or
2. remove the decorative handle.

For this release, remove the handle unless a tested gesture implementation already exists.

## File-level plan

### Modify

- `src/routes/__root.tsx`
- `src/routes/index.tsx`
- `src/components/AddItemSheet.tsx`
- `src/components/AddItemForm.tsx`
- `src/components/MobileNav.tsx`
- `src/services/grocery.api.ts`

### Add/extract

- `src/components/ItemNameCombobox.tsx`
- `src/lib/add-item-search.ts`
- `src/lib/item-identity.ts`
- `src/hooks/useOverlayHistory.ts`

## Acceptance criteria

- Only one full Add form is mounted.
- No duplicate IDs exist.
- Closing Add removes every Add-specific search parameter.
- Browser Back closes an in-app sheet without navigating away.
- A direct Add deep link can be closed safely.
- Keyboard users can traverse and select suggestions using the standard combobox pattern.
- The form states whether submission creates or increments.
- A failed request preserves the draft and offers Retry.
- Retrying uses an idempotent operation ID.
- Unsupported drag affordances are absent.
- Focus returns to the Add trigger after close.
- Screen readers receive one success/failure announcement.

## Tests

- route-state open/close/direct-link cases;
- search-schema invalid values;
- full Add parameter cleanup;
- duplicate ID audit;
- combobox keyboard matrix;
- create-vs-increment suggestion copy;
- retry with same operation ID;
- iOS viewport/input regression;
- focus trap and trigger restoration.
