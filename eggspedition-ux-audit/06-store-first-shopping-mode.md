# UX-006 — Store-first Shopping Mode and Completed Items

**Priority:** P1  
**Primary outcome:** the list becomes easier to use while physically shopping, not only while planning at home.

## Problem

The current Group by Category / Group by Store toggle reorganizes cards, but the app remains a general dashboard. In a store, users need a tighter workflow:

- focus on one location;
- understand progress;
- complete items quickly;
- temporarily see and restore recently completed items;
- avoid scanning unrelated stores and decorative chrome.

The selected grouping resets to Category and completed items are filtered from the main view.

## Product model

Keep the existing planning view and add a focused **Shopping mode**.

### Planning mode

- default home experience;
- group by Category or Store;
- add/edit/share controls available;
- suitable for household planning.

### Shopping mode

- launched from a prominent **Start shopping** action when there are active items;
- ask which store to focus when store metadata exists;
- compact, single-column rows regardless of desktop masonry behavior;
- sticky progress header;
- fewer secondary controls;
- completed items remain recoverable.

## Shopping mode entry

At the top of the active list show:

**12 items to buy**  
`Start shopping`

If items span stores, open a store picker:

- Biedronka — 5 items
- Lidl — 3 items
- Any store — 4 items
- All items — 12 items

Remember the last selected store per household, but do not automatically enter shopping mode on every visit.

## Shopping mode header

Sticky below the safe-area header:

- Back/Exit;
- selected store name;
- progress: `3 of 8 done`;
- thin progress bar;
- optional overflow for Change store and End trip.

Do not show a celebratory modal after each item. Reserve celebration for completion of the selected scope.

## Item rows

- single column;
- minimum 52–56 px height;
- large completion target;
- name may wrap to two lines;
- quantity remains visible;
- category shown as quiet secondary text when shopping by store;
- row body opens editor only through an explicit details affordance if accidental opening becomes common in store testing.

## Completed section

At the end of the scope, render a collapsed section:

**Completed (3)**

Behavior:

- the newest completed item remains temporarily visible near its original position during the Undo period;
- after the Undo period it moves into Completed;
- expand to review and restore;
- restored items return to the active section and decrement progress;
- completed items can be cleared only through an explicit bulk action.

Do not permanently delete completed items as part of normal shopping.

## Scope completion

When all visible items are complete:

- title: **That’s everything for Lidl**;
- actions: **Review completed**, **Shop another store**, **Finish shopping**;
- use restrained success motion and haptics only when platform support is appropriate;
- no confetti dependency is necessary.

Ending shopping mode returns to Planning mode with the Completed section collapsed.

## Group preference

Outside Shopping mode, persist the Category/Store preference:

- per household;
- local preference is sufficient;
- initialize it without a layout flash;
- use a proper segmented-control semantic (`radiogroup` or buttons with `aria-pressed`).

## URL/state contract

Recommended route/search state:

`/?mode=shopping&store=<id>`

Benefits:

- browser Back exits naturally;
- state can survive refresh;
- opening the app from a store-specific shortcut is possible later.

Validate the store against the active household. If invalid, fall back to store picker.

## Offline behavior

Shopping mode must remain usable when connectivity drops:

- cached active and completed items render;
- completion commands queue locally;
- header shows “Offline — changes will sync” rather than a generic cloud badge;
- queued count is available from a details affordance;
- changing store uses cached metadata.

This depends on the actual mutation queue defined in UX-012.

## Accessibility

- sticky progress text is available to screen readers; do not announce every percentage change aggressively.
- completing an item announces its name and Undo availability.
- Completed section is a semantic disclosure with `aria-expanded`.
- store picker includes item counts in accessible names.
- large text and 200% zoom do not obscure the sticky header or bottom navigation.

## Acceptance criteria

- User can start a shopping session and focus one store or all items.
- Shopping mode is single-column and optimized for one-handed completion.
- Progress updates immediately and correctly after Undo/restore.
- Completed items are reviewable and restorable.
- Category/Store planning preference persists without a visual flash.
- The mode remains functional with cached data offline.
- Browser Back exits or changes scope predictably.

## Tests

- store counts and Any store scope;
- progress with complete, undo and restore;
- route refresh and invalid store ID;
- all-items completion flow;
- offline queued completions;
- completed disclosure keyboard behavior;
- 320 px and 200% zoom sticky-layout checks.

## Non-goals

- Geofenced automatic store detection.
- Route optimization through store aisles.
- Payments, loyalty cards or prices.
