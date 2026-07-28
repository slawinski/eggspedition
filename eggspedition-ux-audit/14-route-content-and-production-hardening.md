# UX-014 — Route, Content and Production Hardening

**Priority:** P2  
**Primary outcome:** every production route has a clear product purpose, preserves user intent and contains no starter or development-only experience.

## Problem

The repository still contains starter-facing content and route contracts that no longer match the current product architecture:

- `/about` presents generic TanStack starter copy rather than Eggspedition information;
- the README begins as a generic starter guide and contains claims that may not match current implementation;
- `/quick-add` remains even though Quick Add was removed from primary mobile navigation;
- `/add` redirects authenticated users to the query-driven sheet, but unauthenticated redirect handling must preserve all add intent;
- route-level loading/error/404 UIs use one-off inline styling;
- development tools should be explicitly excluded from production bundles/rendering;
- route headings and skip-link targets should be consistent.

These details reduce product credibility and make maintenance harder.

## Route inventory decision

Create an explicit route table and classify every route as:

- public product route;
- authentication route;
- authenticated primary route;
- authenticated settings route;
- compatibility redirect;
- API route;
- development-only route.

Recommended product routes:

### Public

- `/` — landing when signed out, List when signed in if retaining conditional root;
- `/login`;
- `/join/:token`;
- `/privacy` and `/terms` when required by deployment/data practice;
- `/about` only if it contains genuine product content.

### Authenticated

- `/` — List;
- `/activity`;
- `/settings`;
- `/settings/household`;
- `/settings/quick-add`.

### Search-state actions

- `/?add=item...` for Add composer;
- `/?mode=shopping...` for Shopping mode.

### Compatibility

- `/add` → canonical add search state while preserving validated params;
- `/admin` → `/settings/quick-add` for a deprecation period;
- `/quick-add` → chosen canonical destination or remove if never public/bookmarked.

## About and product content

Choose one:

1. replace `/about` with a concise genuine page covering product purpose, creator/contact, privacy approach and version; or
2. remove the route and link to landing-page content.

Never ship framework starter copy as user-facing product information.

## README and specification hygiene

Rewrite README for the actual project:

- product description and screenshots;
- current architecture;
- local setup and required services;
- environment variables without secrets;
- migrations, seed and deployment process;
- tests and quality checks;
- PWA/icon generation commands;
- current limitations.

Audit `SPEC.md` checkboxes against code. Claims such as virtualization, full optimistic updates and persisted offline mutation support should be marked accurately. Treat the spec as a product/architecture record, not proof that implementation exists.

Add an ADR or concise docs for:

- add composer search-state contract;
- household invite model;
- optimistic command/undo architecture;
- offline queue policy;
- design-system semantic elevation.

## Error and not-found routes

Create reusable route states rather than inline style objects.

### Not found

- heading: **Page not found**;
- short explanation;
- primary action based on auth state: **Go to list** or **Go home**;
- preserve global header only when useful;
- no technical route/path leakage.

### Route error

- friendly message;
- Retry or reload route action;
- reference code only if useful for support;
- log technical error privately;
- cached/partial content retained where safe.

### Pending

Use route-appropriate skeletons. Avoid a full-screen spinner for nested route changes.

## Document semantics

- one page-level `h1` per route/content context;
- brand link is not always the page `h1`;
- every route’s main element has the skip-link target ID;
- page title metadata changes by route, e.g. `Activity · Eggspedition`;
- dialogs update no document heading hierarchy requirement but have labelled titles;
- HTML language reflects current localization strategy.

## Production development tools

Ensure router/query devtools:

- render only when `import.meta.env.DEV` or equivalent is true;
- are excluded from the production bundle where possible;
- do not expose cached household data in production UI;
- do not affect hydration.

## Redirect and search validation

- validate all search params centrally with route schemas;
- preserve same-origin `returnTo` only;
- avoid redirect loops between root, login, onboarding and join;
- use `replace` for compatibility redirects and post-auth completion;
- use normal push navigation for user-initiated screen changes;
- include tests for signed-in and signed-out variants.

## Observability

Add privacy-safe production diagnostics:

- route/error boundary reporting;
- mutation failure categories;
- SSE reconnect health;
- client version/commit identifier;
- no item names, emails, household IDs or invite tokens in routine logs.

Expose a small version string in About/Settings for support.

## Acceptance criteria

- No user-facing route contains TanStack starter copy.
- README and SPEC claims match implemented behavior.
- Legacy routes have an intentional redirect or are removed.
- Add/invite intents survive authentication and redirects.
- Devtools are unavailable in production.
- Every route has correct page title, heading structure and skip-link target.
- Not-found, pending and error states use shared components and actions.
- Production logs avoid household/user content.

## Tests

- route matrix for authentication states;
- redirect parameter preservation;
- no redirect loops;
- production build assertion for devtools;
- page title and heading checks;
- 404/error recovery;
- README commands in CI where practical;
- static scan for known starter phrases and inline route-state styling.

## Non-goals

- Full public documentation site.
- Internationalization implementation; only prepare semantics and content structure for it.
