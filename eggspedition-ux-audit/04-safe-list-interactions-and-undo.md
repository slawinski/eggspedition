# UX-004 — Safe List Interactions and Universal Undo

**Priority:** P0  
**Primary outcome:** users can shop rapidly without accidental completion or deletion causing permanent confusion.

## Problem

The list currently delays check and delete mutations by about 300 ms to play animations. This delay is not a meaningful confirmation window. Completion makes an item disappear, deletion has no confirmation or undo, and failure handling is not visible in the row. The check control is approximately icon-sized rather than a reliable mobile target.

This conflicts with the product’s own “panic undo” intent and is particularly risky while shopping one-handed.

## Product decision

Use immediate optimistic state plus a shared, command-based Undo system. Completion is common and should be low-friction. Permanent deletion is less common and should be secondary.

## Row interaction model

### Tap zones

- Tapping the checkbox area completes/restores the item.
- Tapping the item name/body opens the item editor from UX-005.
- A trailing overflow button opens secondary actions.
- Do not make the entire row complete the item; this would conflict with editing.

All interactive targets must be at least 44×44 CSS pixels. The visible icon can remain 20–24 px.

### Completion

1. Optimistically mark the item complete.
2. Animate opacity/strike-through for 180–240 ms.
3. Move it to a temporary “Just completed” region or keep it in place until the undo toast expires.
4. Show toast: **Milk completed — Undo**.
5. After expiry, collapse it into the completed section defined in UX-006.

Do not immediately remove the item before users can understand what changed.

### Deletion

Move Delete out of the always-visible row controls into:

- item editor; and/or
- row overflow menu.

After delete:

- optimistically remove;
- show **Milk deleted — Undo**;
- retain the item snapshot until the undo window expires;
- rollback on failure.

No blocking confirmation dialog is needed for a single item when Undo is reliable. Confirm bulk destructive actions.

## Undo architecture

Create a shared `UndoProvider` or command manager with typed reversible commands:

- `completeItem`
- `restoreItem`
- `deleteItem`
- `quickAddItem`
- `incrementItem`
- future bulk actions

Each command stores:

- operation ID;
- household ID;
- item ID and required snapshot;
- optimistic cache patches;
- execute/rollback behavior;
- expiry timestamp;
- user-facing message.

### Multiple operations policy

Recommended policy:

- show one toast at a time;
- compatible repeated completions within a short interval may aggregate: “3 items completed — Undo all”;
- deletion remains individually reversible unless a bulk action was explicit;
- undo is household-scoped and cancelled safely if the active household changes.

## Optimistic updates

Update all relevant caches from one command layer:

- active item list;
- grouped list;
- frequent-item/Quick Add counts when applicable;
- activity feed preview;
- progress counters.

Avoid relying only on broad invalidation after the server returns. Invalidation remains a reconciliation step, not the visual interaction model.

On mutation failure:

- rollback the exact patch;
- show a persistent error toast with Retry;
- do not leave an animation-only state stuck;
- announce the failure to assistive technology.

## Swipe gestures

Swipe may be added later as an enhancement, but it must not be the only path. If implemented:

- swipe right: complete;
- swipe left: reveal Edit and Delete, not immediate destructive deletion;
- horizontal intent threshold before capturing gesture;
- vertical scrolling remains dominant;
- visible buttons remain available for accessibility and desktop.

## Accessibility

- checkbox button accessible name: “Mark Milk as completed” or “Restore Milk.”
- expose state with `aria-pressed` or a native checkbox pattern.
- Undo toast uses `role="status"` for normal changes; failures use `role="alert"` sparingly.
- toast Undo button receives no forced focus, but is reachable in normal focus order.
- focus returns sensibly after an item is deleted from an editor.
- animations honor reduced motion.

## Engineering plan

- Replace `finishing`/`deleting` timeout records in `SmartView.tsx` with command mutation state.
- Introduce `ItemRow` as a focused component with explicit callbacks.
- Add `ToastViewport` at the authenticated shell level, positioned above MobileNav and safe area.
- Keep server operations idempotent where possible.
- Use TanStack Query `onMutate`, rollback context and mutation keys/scopes.
- Ensure real-time signals from another household member do not double-apply the local optimistic command.

## Acceptance criteria

- Complete and delete operations render optimistically and can be undone for five seconds.
- Completing an item does not make it vanish before the user sees feedback.
- Delete is not a tiny permanently destructive icon next to every item.
- Every row action has a minimum 44×44 target.
- Failure restores the exact prior state and offers Retry.
- Rapid operations on multiple items do not corrupt quantities or groups.
- Remote sync reconciliation does not duplicate or resurrect confirmed operations incorrectly.

## Tests

- command unit tests for execute, undo, expiry and rollback;
- integration tests for grouped cache patches;
- rapid complete/undo across different groups;
- delete/undo after opening editor;
- mutation failure and server reconciliation;
- local optimistic action plus incoming real-time signal;
- touch-target and accessible-name assertions.

## Non-goals

- Full event-sourcing backend.
- Infinite undo history.
- Gesture-only controls.
