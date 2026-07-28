# UX-009 — Activity History and Panic Undo

**Priority:** P1  
**Primary outcome:** the Activity screen explains what changed, when it changed and what the user can still recover.

## Problem

The activity feed currently renders compact lines such as a member name, raw action word, item name and time-of-day. It does not group by date, expose a meaningful empty state, explain metadata changes or provide the “panic undo” envisioned in the product specification. A time without a date becomes ambiguous beyond the current day, and truncated single-line entries can hide the important item name.

## Product role

Activity is not an audit log for developers. It is a household recovery and coordination tool.

It should answer:

- Who changed the list?
- What exactly changed?
- How recently?
- Can I reverse it?
- Is this action still relevant to the current list?

## Feed structure

Group entries by:

- Today
- Yesterday
- explicit localized date after that

Within a day, newest first.

Use natural action copy:

- “Piotr added Milk.”
- “Anna completed Bread.”
- “Piotr restored Eggs.”
- “Anna deleted Apples.”
- “Piotr changed Milk from 1 to 2.”
- “Anna moved Pasta to Lidl.”

Do not display backend enum values directly.

## Entry layout

Each entry should contain:

- action icon with non-color distinction;
- sentence that may wrap to two lines;
- relative time for recent activity, e.g. “4 min ago”;
- exact date/time in accessible text or a details view;
- optional **Undo** / **Restore** action when still valid.

Avoid forcing all text to one line with ellipsis. Item names are often the most important content.

## Undo validity

Two recovery levels:

### Immediate Undo

The five-second global toast from UX-004 is the fastest path.

### Activity recovery

For a longer window, show a contextual action when the domain allows safe reversal:

- deleted item → Restore;
- completed item → Restore to list;
- quantity change → Revert, only if no later conflicting change occurred;
- add item → Remove, only if the item still matches that event and has not subsequently changed.

The server must validate reversibility. Activity UI should not promise Undo before validation.

If no longer reversible, show a disabled explanation only in details—not a field of disabled buttons in every row.

## Event data model

Current logs should evolve from display-only action/name records to typed domain events with enough information to explain and conditionally reverse changes.

Recommended fields:

- event ID;
- household ID;
- actor ID/display name;
- event type;
- item ID;
- item name snapshot;
- before/after snapshot for reversible fields;
- timestamp;
- client operation ID for optimistic reconciliation;
- reversal status and reversed-by event ID.

Store only necessary item data. Do not expose emails by default when a display name is absent; use “Household member” until profile naming exists.

## Filters

Do not overbuild filters initially. Add only:

- **All**
- **My changes**
- **Restorable**

A search field is unnecessary until activity volume proves it useful.

## Loading, empty and failure states

### Loading

Use 4–6 skeleton rows with `aria-busy` and a hidden status message.

### Empty

Title: **No household activity yet**  
Body: “Changes made by you and other household members will appear here.”  
CTA: **Go to the list**.

### Failure

Message: **Couldn’t load activity**  
Action: Retry. Keep cached entries visible when available and indicate that refresh failed.

## Localization

Use `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` with the user/browser locale. Avoid `toLocaleTimeString([])` as the only timestamp representation.

## Real-time behavior

- prepend new confirmed events without moving the user’s scroll position unexpectedly;
- if scrolled down, show “New activity” pill rather than auto-jumping;
- reconcile local optimistic events with server events using operation ID;
- do not duplicate an event when SSE and query refetch arrive close together.

## Accessibility

- feed can be a semantic list;
- new background events should not all be announced aggressively;
- successful restore is announced through the global status region;
- icon is decorative when sentence conveys the action;
- filters have pressed/selected semantics;
- exact timestamp is discoverable to keyboard and screen-reader users without hover-only UI.

## Acceptance criteria

- Entries use natural copy rather than raw action enums.
- Entries are grouped by date and show unambiguous localized time.
- Text can wrap and preserves the item name.
- Restorable actions are offered only when server validation permits them.
- Loading, empty, cached-error and retry states are complete.
- Incoming real-time activity does not duplicate entries or steal scroll position.

## Tests

- action-copy formatter for all event types;
- date grouping across midnight/timezone boundaries;
- reversibility validation and conflict cases;
- SSE/refetch deduplication;
- cached feed plus refresh failure;
- keyboard filters and restore action;
- long names and 200% text zoom.

## Non-goals

- Permanent compliance-grade audit history.
- Comments or chat on events.
- Arbitrary historical state restoration.
