# Eggspedition UX, Product and Frontend Audit

**Audit date:** 2026-07-27  
**Repository:** `slawinski/eggspedition`, current `main` branch reviewed through GitHub  
**Product intent used for evaluation:** a fast, collaborative, family-oriented grocery list that remains dependable inside a store and uses a distinctive clay-like visual language.

## Executive summary

Eggspedition already has several strong foundations: passwordless authentication, household collaboration, real-time invalidation, category/store grouping, a global mobile add sheet, safe-area-aware mobile navigation, Quick Add templates, activity history, dark mode and PWA metadata.

The main opportunity is not adding more surface area. It is making the existing product more predictable and task-oriented:

1. Make every mutation reversible or recoverable.
2. Turn household setup and sharing into an explicit guided flow.
3. Give users a complete item lifecycle: add, edit, adjust quantity, complete, restore and delete.
4. Optimize the list for the in-store moment rather than for dashboard browsing.
5. Consolidate accessibility, responsive behavior and async feedback into reusable primitives.
6. Reduce visual competition so the clay aesthetic communicates hierarchy instead of decorating every element equally.

## Prioritized issue map

| ID | Issue | Priority | User impact | Estimated size | Depends on |
|---|---|---:|---:|---:|---|
| UX-001 | First-run household onboarding and sharing | P0 | Very high | M | — |
| UX-002 | Add-item composer, deep links and accessibility | P0 | Very high | M | UX-012 |
| UX-003 | Quick Add repeat-to-increment feedback and concurrency | P1 | High | M | UX-004, UX-012 |
| UX-004 | Safe list interactions and universal undo | P0 | Very high | L | UX-012 |
| UX-005 | Item editing and quantity management | P0 | High | L | UX-004 |
| UX-006 | Store-first shopping mode and completed items | P1 | High | L | UX-004, UX-005 |
| UX-007 | Responsive list rendering without JS breakpoints | P1 | Medium-high | M | — |
| UX-008 | Navigation, account menu and brand hierarchy | P1 | High | M | UX-001 |
| UX-009 | Activity history with panic undo | P1 | Medium-high | M | UX-004 |
| UX-010 | Mobile-first template management | P1 | Medium | M | UX-003, UX-005 |
| UX-011 | Magic-link authentication and return-intent flow | P1 | High | M | UX-001, UX-002 |
| UX-012 | Unified loading, offline, error and sync feedback | P0 | Very high | L | — |
| UX-013 | Visual system, accessibility and motion cleanup | P2 | Medium-high | L | — |
| UX-014 | Route, content and production hardening | P2 | Medium | S–M | UX-002, UX-011 |

## Recommended delivery sequence

### Release 1 — Trustworthy core loop

Implement UX-012, UX-004, UX-003 and UX-002. This release makes the core mutation loop dependable: Quick Add remains rapidly repeatable under latency, while list actions gain rollback, useful failure feedback and real undo.

**Success signal:** a user can add, quick-add, complete or remove an item under slow or unreliable network conditions without losing confidence in the list.

### Release 2 — Complete product model

Implement UX-005, UX-001 and UX-011. This completes the item lifecycle and removes household setup from hidden account-menu controls.

**Success signal:** a new user can create or join the right household, then add and correct an item without deleting and recreating it.

### Release 3 — In-store optimization

Implement UX-006, UX-007 and UX-009. This turns the product from a grouped dashboard into a better shopping companion.

**Success signal:** while walking through a store, the user can focus one store, tap full-width rows, recover accidental completion and understand recent household changes.

### Release 4 — Information architecture and polish

Implement UX-008, UX-010, UX-013 and UX-014.

**Success signal:** the app has a coherent brand, accessible navigation and dialogs, a mobile-usable settings area, a lighter visual hierarchy and no starter/dead production surfaces.

## Product principles for all implementation work

1. **The list is the product.** Every secondary feature should reduce work on the list rather than compete with it.
2. **Fast must also be reversible.** Optimistic UI is valuable only with rollback and an understandable undo path.
3. **One-handed by default.** Primary mobile actions must work with the thumb, provide at least a 44×44 CSS-pixel target and avoid precision tapping.
4. **Progressive disclosure.** Item name and Add are primary; quantity, category and store are available without requiring undocumented syntax.
5. **Offline is a state, not a badge.** The user needs to know whether a change is saved locally, syncing, confirmed or failed.
6. **Clay indicates interactivity and grouping.** Do not apply the same depth and glow to every container.
7. **No hidden product concepts.** “Household,” “Quick Add template,” “Category” and “Store” require plain-language onboarding and contextual explanations.
8. **URLs preserve intent.** Authentication and redirects must retain the destination and prefilled item data.

## Shared definition of done

Every issue should include:

- keyboard and screen-reader behavior;
- 320 px, 375 px, 430 px, tablet and desktop layouts;
- light and dark theme checks;
- `prefers-reduced-motion` behavior;
- pending, success, offline and failure paths;
- unit tests for domain behavior;
- component/integration tests for interaction behavior;
- no hard reload as a normal state transition;
- no duplicate element IDs;
- no icon-only control without an accessible name;
- no destructive mutation without confirmation or undo.

## Suggested product analytics vocabulary

Use a small, stable event set rather than component-specific names:

- `household_setup_started`, `household_created`, `household_joined`, `household_invite_shared`
- `add_composer_opened`, `item_added`, `item_add_failed`
- `quick_add_used`, `quick_add_incremented`
- `item_completed`, `item_restored`, `item_deleted`, `item_edited`
- `undo_shown`, `undo_used`, `undo_expired`
- `shopping_mode_started`, `shopping_store_selected`, `shopping_mode_completed`
- `auth_link_requested`, `auth_link_retried`, `auth_completed`

Do not include item names, email addresses or household IDs in analytics payloads.

## Primary repository touchpoints reviewed

- `src/routes/__root.tsx`, `index.tsx`, `login.tsx`, `add.tsx`, `quick-add.tsx`, `activity.tsx`, `admin.tsx`, `about.tsx`
- `src/components/AddItemForm.tsx`, `AddItemSheet.tsx`, `QuickAdd.tsx`, `SmartView.tsx`
- `src/components/Header.tsx`, `MobileNav.tsx`, `SyncIndicator.tsx`
- `src/components/ShareHousehold.tsx`, `HouseholdActivityFeed.tsx`, `AdminDashboard.tsx`
- matching CSS Modules, `src/styles.css` and `src/styles/clay.module.css`
- `README.md`, `SPEC.md`, `package.json` and public/PWA structure
