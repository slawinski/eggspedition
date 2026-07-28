# UX-002 — Add-item Composer, Deep Links and Accessibility

**Priority:** P0  
**Primary outcome:** adding an item is fast for a novice, efficient for a power user and consistent across inline, sheet and deep-link entry points.

## Problem

`AddItemForm` has grown into a large component that serves inline and sheet variants. It supports useful name parsing and metadata, but the experience has structural risks:

- the same fixed input ID can exist in the inline composer and the globally mounted sheet;
- suggestions are visually interactive but do not implement combobox/listbox semantics;
- category and store are discoverable in the sheet, while the compact desktop form relies more heavily on undocumented `#category` and `@store` syntax;
- deep-link routes redirect through authentication without consistently preserving item intent;
- suggestions and metadata can change layout height rather than behaving as a controlled popover;
- one component owns parsing, fetching, keyboard behavior, mutation state, layout and success feedback.

## Product decision

Keep one **Add Composer domain model** with two responsive presentations:

- **Mobile:** bottom sheet opened by the central Add button.
- **Desktop/tablet:** compact inline composer on the List page; deep links may open a focused dialog when the user is not on List.

These are presentations of the same state machine, validation and mutation logic—not separate implementations.

## Core flow

1. Open composer.
2. Name field receives focus only when that will not cause an undesirable viewport jump.
3. User types an item name.
4. Suggestions appear as a real combobox popup.
5. Press Enter or tap **Add** to add with defaults.
6. Optional **Details** disclosure exposes quantity, category and store.
7. On success, keep the composer ready for the next item and announce the result.
8. On failure, keep all entered data and offer Retry.

## Input behavior

### Name

- Label: **Item**.
- Placeholder: “Milk, bananas, pasta…”
- `enterKeyHint="done"` when adding one item; `enterKeyHint="next"` when continuous-add mode is explicit.
- Trim outer whitespace, preserve meaningful internal spacing.
- Do not silently title-case user input.

### Quantity

Use a stepper in the expanded details region:

`−  1  +`

- minimum 1;
- support direct numeric entry;
- display unit-free quantity unless units become a separate domain feature.

### Category and store

- Searchable select/combobox.
- Existing values first.
- “Create ‘X’” option only after an exact-match check.
- Category and store selections remain optional.
- Preserve `#` and `@` parsing as an advanced shortcut, but expose a small one-time hint rather than making syntax the only discoverable path.

## Suggestion semantics

Suggestions should prioritize:

1. exact unchecked-list match;
2. Quick Add template match;
3. recent/frequent item;
4. plain typed value.

An existing unchecked item must not be presented as “add another” without clarity. Show:

- item name;
- current quantity;
- action label **Increase quantity**.

## Accessible combobox specification

Use either a proven accessible primitive or implement the WAI-ARIA combobox pattern:

- input has `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`;
- popup has `role="listbox"`;
- options have stable IDs and `role="option"`;
- active option is represented through `aria-activedescendant`;
- Arrow Up/Down moves active option;
- Enter selects;
- Escape closes suggestions before closing the parent sheet;
- Tab commits no implicit selection;
- screen readers receive result count and add success via polite live regions.

Generate all IDs with `useId()` or an injected instance ID. No fixed IDs shared by multiple component instances.

## Adaptive sheet/dialog behavior

### Mobile below 768 px

- bottom sheet anchored above the safe area;
- 16 px side margins only if the design intentionally uses a floating sheet; otherwise edge-to-edge;
- max height uses `100dvh`, not `100vh`;
- content scrolls independently while the action row remains visible;
- either implement drag-to-dismiss with threshold/velocity and scroll arbitration, or remove the decorative drag handle.

### Desktop/tablet

- centered dialog, max width approximately 560–640 px;
- no fake bottom-sheet drag affordance;
- autofocus is acceptable when it does not move the viewport;
- close button, Escape and backdrop behavior are consistent.

## Deep-link contract

Support one canonical URL:

`/?add=item&name=Milk&quantity=2&category=Drinks&store=Biedronka`

Legacy `/add` may redirect to it, but must preserve all recognized values.

Rules:

- validate search params with Zod;
- preserve parameters through `/login?returnTo=...`;
- after authentication, reopen the composer with the same values;
- do not auto-submit from a URL;
- discard unrecognized parameters;
- closing the composer removes only add-related search params and preserves the current route/query state.

## Architecture

Refactor into:

- `useAddItemComposer()` — state machine, parsed values, validation, mutation;
- `AddItemNameCombobox`;
- `AddItemDetails`;
- `AddItemInline`;
- `AddItemDialog` / `AddItemSheet`;
- pure `parseAddItemInput()` domain function;
- pure suggestion-ranking function.

Keep mutation/cache behavior in a dedicated command hook so Quick Add and item editing can reuse consistent query updates.

## Acceptance criteria

- No duplicate IDs exist when inline and sheet instances are mounted.
- Mobile and desktop use the same validation/parsing/mutation domain code.
- Category/store controls are discoverable without knowing shortcut syntax.
- Existing unchecked items clearly increment rather than silently duplicate.
- Deep-link item data survives sign-in.
- Failed additions retain user input and expose Retry.
- Escape closes suggestions first, then details/popover, then the sheet/dialog.
- The visual drag handle is functional or removed.

## Tests

- parser unit tests for names, quantities, `#category`, `@store` and ambiguous symbols;
- suggestion ranking and duplicate/increment behavior;
- keyboard combobox integration tests;
- two simultaneous composer instances produce unique IDs;
- deep-link → login → return flow;
- visual tests with iOS keyboard and `dvh`;
- mutation failure and retry without input loss.

## Non-goals

- Barcode scanning.
- Voice dictation beyond the browser/OS keyboard feature.
- Units, prices or recipe parsing.
