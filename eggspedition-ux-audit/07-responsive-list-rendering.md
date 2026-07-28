# UX-007 — Responsive List Rendering Without JavaScript Breakpoints

**Priority:** P1  
**Primary outcome:** the grouped list renders stably across widths without hydration shifts, resize listeners or duplicated responsive logic.

## Problem

`SmartView.tsx` initializes three columns, reads `window.innerWidth` after mount, attaches a resize listener and manually distributes groups round-robin across arrays. This creates several risks:

- server and first client render can disagree with the actual viewport;
- mobile can briefly render desktop structure;
- JavaScript and CSS maintain separate breakpoint knowledge;
- resizing rebuilds column structure and can reorder focus/reading flow;
- round-robin distribution optimizes visual balance but not semantic source order;
- no container awareness when the component is placed in a narrower layout.

## Product decision

Use CSS for responsive columns and preserve a logical DOM order. JavaScript should not decide basic responsive column count.

## Recommended layout

### Mobile

One column in DOM order.

### Tablet/desktop

Use CSS Grid:

```css
.groupGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  align-items: start;
  gap: var(--space-4);
}
```

Each group card is one grid item. This produces stable order and adapts to container width.

Do not use CSS multi-column layout if it causes vertical reading order to flow down one column and up the next in a way that conflicts with expected group order.

## Source ordering

Define one deterministic group ordering before render:

- named groups alphabetically using locale-aware comparison;
- “Uncategorized” / “Any Store” last, unless research shows it is usually the largest and should be first;
- optionally pinned store/category order later.

Render a flat array of group cards. Do not distribute into per-column arrays.

## Container queries

Where supported by the browser target, make the list container a query container so group/card density responds to available width rather than the window.

Fallback media queries are acceptable. Keep breakpoint tokens in one global CSS token/documentation source.

## Loading stability

Replace “Organizing your list…” text with skeletons that approximate final group-card dimensions:

- one column on small containers;
- two or three through the same CSS grid rules;
- no JS breakpoint calculation;
- `aria-busy="true"` on the list region;
- visually hidden status text for assistive technology.

When switching grouping:

- retain current content until new grouped data is available using `placeholderData` where appropriate;
- show a subtle pending state on the segmented control;
- do not blank the whole list.

## Rendering performance

Before adding virtualization, measure realistic list sizes. Grocery lists usually remain small; virtualization can harm dynamic card measurement, focus and screen-reader continuity if used prematurely.

Recommended sequence:

1. remove unnecessary resize-state re-renders;
2. memoize pure group transformations;
3. avoid broad query invalidation;
4. profile long synthetic lists;
5. introduce virtualization only above a measured threshold and only for the single-column shopping view if needed.

The existing project specification claims TanStack Virtual integration, but the current grouped rendering should be verified rather than assuming that claim is true.

## Focus and animation

- DOM order must remain stable across breakpoints.
- Do not animate cards between CSS grid columns during a window resize.
- When an edited item moves groups, focus stays in the editor or returns to the moved row via its stable ID.
- `content-visibility: auto` may be tested for below-the-fold group cards, but only after accessibility and scroll-anchor validation.

## Engineering plan

In `SmartView.tsx`:

- remove `columnCount` state;
- remove resize `useEffect`;
- remove `columnData` distribution;
- map sorted groups directly.

In `SmartView.module.css`:

- replace `.masonryGrid` and `.masonryColumn` with `.groupGrid`;
- define density through container/media queries;
- maintain mobile one-column behavior;
- ensure empty state spans the grid with `grid-column: 1 / -1`.

Add a pure selector:

`selectVisibleSortedGroups(groupedData, finishingState)`

This makes transformation testable and keeps JSX simple.

## Acceptance criteria

- No viewport-width JavaScript is used to choose list columns.
- First render structure is valid on server and client at all target widths.
- DOM/keyboard reading order is stable across breakpoints.
- Empty and loading states occupy the full grid correctly.
- Group switch retains previous content until the new result is ready.
- Resize does not trigger React state updates for layout.
- 320 px through wide desktop layouts have no horizontal overflow.

## Tests

- selector ordering and special-group placement;
- server render/hydration test without `window` dependency;
- visual regression at representative container widths;
- keyboard order before and after resize;
- group-switch loading behavior;
- performance profile with 500 synthetic items.

## Non-goals

- Pinterest-style perfectly balanced masonry.
- Dragging groups between columns.
