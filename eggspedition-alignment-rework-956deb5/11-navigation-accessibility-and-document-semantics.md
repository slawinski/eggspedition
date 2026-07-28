# RW-011 — Navigation, Accessibility and Document Semantics Completion

**Priority:** P1  
**Maps to:** UX-008, UX-013, UX-014  
**Primary outcome:** each route has a coherent heading and focus structure, controls use valid semantics, and navigation exposes the product hierarchy without accessibility regressions.

## Verified implementation

The revision includes:

- a skip link;
- account menu keyboard handling;
- account/household settings entry;
- mobile navigation and central Add;
- theme toggle;
- logout cache cleanup;
- route-level `<main id="main-content">` on many authenticated screens;
- shared error/empty/loading components.

## Discrepancies

### Brand is the global `h1`

`Header` wraps the Eggspedition logo link in an `h1`. As a result, route content often uses `h2` for its actual page title. The document outline describes the brand as the page topic on every route.

### Inconsistent route headings

Home, Activity and Quick Add settings use lower-level headings in places. Each route should have one page `h1`.

### Generic authenticated brand mark

The header uses a generic shopping-basket icon instead of the established egg/product mark. This weakens brand consistency with PWA assets and landing page.

### Settings information architecture

The account menu links directly to Household Settings and Quick Add settings but does not provide a coherent settings landing route if more sections are expected.

### Menu details

The menu manually manages focus index. It should be tested against route links, disabled items, Tab behavior, outside click and focus restoration. A simpler disclosure menu may be more appropriate than full `role=menu` semantics for ordinary navigation links.

### Cross-component semantic defects

Other audited components introduce:

- duplicate IDs in Add;
- nested buttons in template cards;
- unsupported drag handle;
- missing selected semantics on group switcher;
- errors without retry/field association;
- remaining fixed IDs in modal forms.

These are covered in their feature specs but require one acceptance audit.

## Product decision

### Heading rule

- Header brand link is a neutral `div`/`span`, not a heading.
- Every route renders one visible or visually appropriate `h1`.
- Section headings descend without skipping levels.
- Dialog headings are scoped within dialogs and do not replace the page `h1`.

Examples:

- Home: `My grocery list`
- Shopping: `Shopping at Lidl`
- Activity: `Household activity`
- Quick Add settings: `Quick Add`
- Household settings: `Household settings`

### Main landmark rule

Every route renders exactly one target with `id="main-content"` or the shell provides it around the outlet. Prefer shell ownership to avoid missing IDs on exceptional routes:

```tsx
<main id="main-content" className={styles.main}>
  <Outlet />
</main>
```

Routes then render sections/divs, not nested main elements.

If some public routes require special main styling, expose a layout mechanism but preserve one main landmark.

## Header/navigation design

### Authenticated

- product egg mark and wordmark;
- no duplicate page title;
- account disclosure;
- quiet sync status only when meaningful;
- desktop primary navigation only for high-frequency destinations.

### Mobile

Keep:

- List;
- Add;
- Activity.

Settings remain in account menu. Avoid adding Quick Add as a fourth permanent destination unless usage data proves it is primary.

### Public

Landing anchors should only render where targets exist. On non-landing public routes, navigate to `/#how-it-works` or hide those anchors.

## Account disclosure semantics

Choose one pattern.

### Recommended: disclosure navigation

- trigger `aria-expanded`;
- popup has ordinary navigation list;
- links remain normal links;
- Escape closes/restores focus;
- Tab moves through and out naturally;
- no roving `tabIndex` required.

Use `role="menu"` only if implementing the full application-menu keyboard model. Navigation links generally do not need menu roles.

## Brand asset

Reuse the corrected square egg mark as an SVG component optimized for UI:

- viewBox centered;
- currentColor or theme variants;
- no emoji rendering dependency;
- alt text supplied by adjacent wordmark link only;
- decorative icon `aria-hidden`.

## Forms and overlays checklist

All modal/sheet components must:

- generate unique IDs;
- trap focus;
- restore trigger focus;
- prevent background interaction;
- close on Escape where safe;
- announce title/error;
- respect reduced motion;
- not imply unsupported gestures.

## Selection controls

Group-by and similar binary selectors use either:

- tabs (`role=tablist`) when switching views; or
- radiogroup when selecting one preference; or
- pressed buttons with `aria-pressed`.

Do not rely only on color/background.

## Focus after dynamic removal

For list/template deletions:

1. focus next logical sibling;
2. otherwise previous sibling;
3. otherwise section heading/empty-state action.

Do not return focus to a detached node.

## Visual/accessibility validation

Required checks:

- axe-core on every route/state;
- keyboard-only walkthrough;
- 200% and 400% zoom;
- 320 CSS pixel reflow;
- light/dark contrast;
- reduced motion;
- VoiceOver iOS Safari;
- NVDA or equivalent desktop screen reader;
- PWA standalone safe-area layout.

## File-level plan

### Modify

- `src/components/Header.tsx`
- `src/routes/__root.tsx`
- route components/headings;
- account menu implementation;
- group switchers;
- shared dialog/sheet primitive.

### Add

- `src/components/BrandMark.tsx`
- `src/components/ui/Dialog.tsx` or a tested accessible dialog abstraction;
- route-level accessibility tests.

## Acceptance criteria

- Header brand is not an `h1`.
- Every route has exactly one meaningful page `h1`.
- There is exactly one main landmark and the skip link always reaches it.
- Public anchor links never target missing IDs.
- Account disclosure works with Enter, Space, Escape, Tab and outside click.
- Focus returns to the trigger after close.
- Product egg mark is used consistently.
- No duplicate IDs or nested interactive elements remain.
- Every selected control exposes programmatic state.
- Dynamic removal moves focus predictably.
- Dialogs/sheets meet focus and background-inert requirements.
- Automated accessibility scan has no serious/critical violations.

## Tests

- route heading/main landmark snapshots;
- skip-link destination;
- account disclosure keyboard matrix;
- public navigation from login/about;
- focus after row/card delete;
- group selector semantics;
- dialog focus trap/restore;
- reduced-motion style tests;
- axe route suite.
