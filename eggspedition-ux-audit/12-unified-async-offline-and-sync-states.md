# UX-012 — Unified Loading, Offline, Error and Sync Feedback

**Priority:** P0  
**Primary outcome:** users can distinguish local action, queued action, server confirmation and failure throughout the app.

## Problem

Async feedback is currently component-specific: text loaders, spinning icons, disappearing animations, query invalidation and a global SyncIndicator based on the total count of fetching/mutating queries. This can label background reads as “Syncing,” does not identify which changes are pending, and does not guarantee that offline mutations are actually queued despite offline-oriented product claims.

A generic “Synced” cloud can create false confidence if a mutation failed or only exists in local optimistic state.

## State model

Define explicit mutation states:

1. **Local optimistic** — UI updated immediately.
2. **Queued offline** — stored locally, not sent.
3. **Sending** — request in progress.
4. **Confirmed** — server acknowledged.
5. **Failed recoverable** — rolled back or retained locally with Retry.
6. **Conflict** — server state changed incompatibly.

Queries separately have:

- initial loading;
- cached/stale data;
- refreshing;
- failed with cached data;
- failed without data.

Do not reduce all of these to one fetching/mutating counter.

## Global status design

### Normal online/confirmed

Do not persistently show “Synced” text on small screens. Silence is a valid success state.

### Active foreground change

Use local row/button status first. Global indicator may briefly pulse without text.

### Offline with no queued changes

Header indicator: **Offline**.  
Details: “You can view cached items. New changes will sync when connection returns.”

### Offline with queued changes

Header indicator: **3 changes waiting**.  
Tapping opens a small status panel listing operation type/time, not sensitive item content if privacy is a concern.

### Failed changes

Persistent attention state: **1 change needs help** with Retry/Discard details.

### Background refresh failure

Keep cached content and show a quiet inline banner: “Showing saved list. Couldn’t refresh.”

## Mutation queue

If offline-first behavior is a product promise, implement a real persisted queue.

Requirements:

- only serializable, typed commands;
- operation IDs for idempotency;
- household-scoped ordering;
- persisted in an app-owned storage key;
- replay on reconnect and app start;
- exponential backoff for transient failure;
- permanent validation errors stop and request user action;
- logout either safely clears queued authenticated mutations or explicitly asks the user before discarding unsynced changes;
- household switching cannot replay commands into the wrong household.

Use TanStack Query’s network mode/persistence only where its semantics meet these requirements; add a domain queue if necessary.

## Shared UI primitives

Create:

- `AsyncButton` with idle/pending/success/error states;
- `InlineError` with Retry;
- `Skeleton` variants;
- `EmptyState` with title/body/action;
- `ToastViewport` and typed toast actions;
- `SyncStatusButton` and `SyncStatusPanel`;
- `OfflineBanner` for full-screen critical contexts;
- `MutationStatus` hooks for per-item operation state.

Avoid every component inventing its own spinner dimensions, copy and live region.

## Query behavior

- choose deliberate `staleTime` by resource;
- do not invalidate every query globally after a household mutation;
- patch known caches optimistically;
- invalidate focused query keys for reconciliation;
- retain previous grouped data during group switches;
- cancel stale outgoing queries before optimistic patches;
- use error boundaries only for route-level unrecoverable failures, not normal mutation errors.

## Copy system

Messages must name the action where useful:

- “Couldn’t add Milk.”
- “Milk is saved on this device and will sync later.”
- “Couldn’t refresh activity.”
- “This item changed in another session.”

Avoid generic “Something went wrong” unless no safer detail exists.

## Accessibility

- use `role="status"` for non-urgent progress/success;
- use `role="alert"` for failures requiring attention;
- do not announce every background query;
- spinners have hidden descriptive text or are decorative beside visible text;
- skeletons are hidden from the accessibility tree;
- queued/sync status is available without relying on color or animation.

## Engineering plan

- replace `useIsFetching()` / `useIsMutating()` as the sole SyncIndicator logic;
- define typed mutation metadata such as `{ userVisible, entityType, operationId }`;
- build one cache command layer used by Add, Quick Add, edit, complete and delete;
- create a connectivity/queue store that initializes safely during hydration;
- namespace persisted keys and remove `localStorage.clear()`;
- test reconnection and duplicate command delivery.

## Acceptance criteria

- Users can tell whether a change is confirmed, queued or failed.
- A background query does not misleadingly show a user mutation as syncing.
- Cached data remains visible on refresh failure.
- Offline changes are either genuinely queued or the UI explicitly says they cannot be saved; no false offline-first claim.
- Failed mutations expose Retry and do not leave stale animation state.
- Queue operations are idempotent and household-scoped.
- Shared loading/error/empty primitives replace one-off implementations in core screens.

## Tests

- offline add/complete/edit queue and replay;
- app restart with queued operations;
- duplicate replay idempotency;
- household switch/logout with queued changes;
- cached query plus refresh failure;
- permanent validation error;
- live-region announcement volume;
- background query does not trigger misleading status copy.

## Non-goals

- Full collaborative CRDT implementation.
- Guaranteed edits while offline if the backend cannot reconcile them safely; explicit limitations are acceptable.
