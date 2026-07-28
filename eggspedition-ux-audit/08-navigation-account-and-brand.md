# UX-008 — Navigation, Account Menu and Brand Hierarchy

**Priority:** P1  
**Primary outcome:** users always know where they are, can reach settings without hidden controls and see one consistent Eggspedition brand mark.

## Problem

The authenticated mobile nav has a sensible List / Add / Activity structure, but secondary product areas are hidden inside a custom profile dropdown. The dropdown lacks complete menu/dialog semantics, keyboard behavior and focus management. Household actions are duplicated there. The brand uses a generic shopping-basket icon even though the product name and prior visual direction center the egg identity.

On public mobile widths, header navigation needs an explicit compact CTA strategy rather than simply hiding the complete desktop nav.

## Product decisions

1. Keep three primary mobile actions: **List**, **Add**, **Activity**.
2. Move configuration into a dedicated **Settings** route, linked from the account menu.
3. Remove household join/share form controls from the dropdown; link to Household settings.
4. Use the Eggspedition egg mark consistently in Header, landing page, PWA assets and product preview.
5. Treat Add as an action, not a navigation destination; the current central button/dialog semantics are correct.

## Authenticated header

### Mobile

- egg mark + optional compact wordmark;
- sync state only when it requires attention; hide persistent “Synced” text if space is constrained;
- account button with avatar/icon;
- no duplicate page title if the route already provides one.

### Desktop

- brand at left;
- optional primary links: List, Activity;
- Add item CTA where appropriate;
- status, theme and account at right.

The primary navigation must not be split unpredictably between top and bottom on the same viewport.

## Account menu

Use an accessible menu or popover primitive.

Trigger requirements:

- `aria-label="Open account menu"`;
- `aria-haspopup="menu"`;
- `aria-expanded`;
- visible focus state.

Menu items:

- account email as non-interactive context;
- **Household settings**;
- **Quick Add templates**;
- **Appearance** or retain theme toggle in header, but not both without reason;
- **Log out**.

Behavior:

- Escape closes and returns focus to trigger;
- Arrow keys navigate menu items when using menu semantics;
- click/tap outside closes;
- route change closes;
- first item is focused only when opened by keyboard;
- joining or sharing never occurs inside this small menu.

## Settings information architecture

Create `/settings` with mobile-friendly cards/sections:

- Household
- Quick Add templates
- Appearance
- Account
- About Eggspedition

On desktop, sections may use a side navigation. On mobile, use a simple list with drill-in routes.

Rename `/admin` to `/settings/templates` or `/settings/quick-add`. “Admin” is an implementation-oriented term and may imply elevated permissions that do not exist.

## Mobile bottom navigation

Retain the current three-column shape, with these refinements:

- labels at a readable 11–12 px equivalent rather than 10 px uppercase where possible;
- active state relies on more than color;
- use route-prefix matching for nested list/activity screens;
- central Add button open state rotates or morphs subtly only if it improves close discoverability;
- toast and sheets position relative to nav + safe area through shared layout variables;
- do not render bottom nav during onboarding, login or full-screen shopping mode if those flows define a clearer navigation model.

## Public header

At mobile width show:

- egg logo;
- theme toggle only if it does not crowd the header;
- one clear **Start** or **Log in** button.

“How it works” and “Features” can remain in page content or an optional menu. Do not leave a public visitor without a visible authentication CTA above the fold.

## Brand mark

Create one source SVG component and generated raster/PWA assets:

- centered egg silhouette/yolk treatment;
- square optical bounds;
- legible at 16, 24, 32 and 48 px;
- monochrome/maskable version;
- light/dark-safe color treatment;
- no generic basket icon in product-brand positions.

Lucide icons remain appropriate for functional actions such as List, Store, Delete and Settings.

## Logout

Do not call `localStorage.clear()`. Remove only keys owned by Eggspedition that must be discarded. Preserve appearance preference and other safe local UI preferences unless the user explicitly resets them.

After logout:

- clear authenticated query data;
- invalidate the router/session;
- navigate to the public landing page;
- announce/log out visually;
- no stale authenticated shell flash.

## Acceptance criteria

- Account menu is fully operable by keyboard and restores focus.
- Household and template management are dedicated settings destinations.
- “Admin” no longer appears as the user-facing name unless real admin roles exist.
- Public mobile header always exposes a start/login action.
- All brand placements use the same egg mark source.
- Bottom nav active state works for nested routes and remains readable.
- Logout removes only app-owned sensitive state and navigates cleanly.

## Tests

- keyboard account-menu flow;
- click outside, Escape and route-change close behavior;
- mobile public header at 320 px;
- bottom-nav active state on nested routes;
- logout storage-key preservation;
- icon snapshots at required asset sizes;
- screen-reader names for all header controls.

## Non-goals

- A full desktop sidebar.
- User profile photos.
- Role-based administration.
