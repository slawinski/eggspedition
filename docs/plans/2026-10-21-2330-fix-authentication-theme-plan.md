---
title: Authentication Theme Alignment - Plan
type: fix
date: 2026-10-21
topic: authentication-theme
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Authentication Theme Alignment - Plan

## Goal Capsule

- **Objective:** People signing in to Eggspedition experience a consistent app theme and can identify the next action throughout authentication.
- **Means:** Direction C: a card-free authentication flow with a simplified header (Product Key Decisions; KTD1–KTD3).
- **Product authority:** The user selected C over two card-based sketches, chose the simplified authentication header, and confirmed the scope below.
- **Open blockers:** None.
- **Authority:** The Product Contract governs behavior; the Planning Contract governs implementation within it.
- **Execution profile:** Presentation changes with targeted interaction regressions and browser-first visual proof; preserve the existing authentication services and destination resolver.
- **Completion owner:** The autonomous shipping workflow owns implementation, verification, and PR delivery after this planning handoff.
- **Stop conditions:** Escalate evidence that the confirmed composition or header cannot work, or that delivery requires changing R8's authentication contract.

---

## Product Contract

### Summary

Redesign authentication as a focused, card-free form on the app background, using Eggspedition's existing typography and theme colors.
Apply one layout language across sign-in steps and recovery states, with a home-linked logo and theme toggle in the header.

### Problem Frame

The supplied mobile screenshots show a large, heavily shadowed white card, a repeated “Welcome Home!” heading, an email field with little visible definition, and equally prominent teal actions.
The card changes vertical position between steps, while the public header continues to offer sign-in and start-list actions during sign-in.
The user identified both the initial card and its subsequent views as inconsistent with the app theme.

### Key Decisions

- **Direction C.** Governs R1–R3. (session-settled: user-directed — chosen over focused-card and page-welcome-plus-task-card layouts: the user preferred the open, card-free composition.)
- **Authentication-specific header.** Governs R4. (session-settled: user-directed — chosen over keeping the public header: remove duplicate entry actions and focus attention on the current task.)
- **Presentation redesign with flow continuity.** Governs R5–R8. (session-settled: user-approved — chosen over expanding into authentication behavior changes: the confirmed scope retains existing methods, sequence, and destinations.)
- **The sketch establishes composition, not a new visual identity.** Governs R2–R3; its placeholder styling does not supersede the app theme.

### Requirements

**Composition and theme**

- R1. Present all app-owned authentication steps and recovery screens directly on the page background without an enclosing card or modal.
- R2. Use Eggspedition's existing typography, semantic colors, and rounded control language in light and dark themes.
- R3. Keep a consistent content column and heading position across steps, adapting to mobile keyboards and desktop widths without clipping or horizontal overflow.
- R4. On authentication screens, show the home-linked logo and theme toggle in the header instead of marketing navigation or duplicate sign-in/start-list actions.

**Step clarity and interaction**

- R5. Give email entry, code verification, returning passkey sign-in, and optional passkey setup distinct headings and concise instructions for the current task.
- R6. Give each step one visually dominant action, with alternative methods, resend, change-email, cancellation, and skip actions visibly subordinate when available.
- R7. Give email and code inputs visible boundaries, persistent labels, keyboard-visible focus, and readable disabled states while retaining existing input and autofill behavior.
- R8. Preserve existing authentication methods, step sequence, optional enrollment, fallback/cancellation behavior, and post-authentication destination rules.

**Feedback and recovery**

- R9. Present pending, offline, validation, delivery, verification, and passkey feedback within the same layout, retaining actionable recovery guidance and existing retry restrictions.
- R10. Apply the same presentation to invalid or expired email-link recovery, preserving its email-code recovery action.
- R11. Keep feedback announced to assistive technology and preserve usable focus when the active step changes.

### Layout Reference

Direction C uses this top-to-bottom composition: a compact logo/theme header; an open, width-constrained content column; a step-specific heading and short explanation; labeled inputs when needed; a dominant action; then quieter alternatives and feedback.
The content begins at a consistent location rather than recentering each shorter step vertically.
The email-code step replaces the heading, instructions, and task controls in that column; passkey steps follow the same composition.
This prose is the durable layout reference; the disposable browser sketch is not a pixel specification.

### Key Flows

- F1. **Email sign-in. Covers R1–R9, R11.** Open authentication, enter email, request a code, then verify it in the same open layout; existing resend and change-email paths remain available.
- F2. **Returning passkey. Covers R1–R6, R8–R9, R11.** Select passkey sign-in, reach its explicit device-confirmation step, then authenticate or return to email using the existing fallback behavior.
- F3. **Optional setup. Covers R1–R6, R8–R9, R11.** After email authentication, offer optional passkey setup with a quieter continue-without-setup action; completion follows existing destination rules.
- F4. **Email-link recovery. Covers R1–R4, R8–R11.** An invalid or expired link shows themed recovery guidance and the existing action to request an email code.

### Acceptance Examples

- AE1. **Covers R1–R7.** On a narrow mobile viewport, moving from email entry to code verification changes the task heading and controls without introducing a card or vertically recentering the content.
- AE2. **Covers R5–R8.** When device passkey confirmation is ready, its action is dominant and the email fallback is subordinate; cancellation still returns to the existing fallback path.
- AE3. **Covers R5–R9.** When optional enrollment is offered, the user can continue without creating a passkey and reach the destination determined by the existing routing rules.
- AE4. **Covers R2–R4, R7, R9, R11.** In either theme, a keyboard user can identify the active field, focus each available action, and receive announced error or pending feedback without losing access to recovery.
- AE5. **Covers R8–R10.** Offline, incorrect-code, resend-cooldown, and invalid-link states retain their existing restrictions and recovery actions within the redesigned presentation.

### Scope Boundaries

- No new authentication providers, methods, account rules, or changes to the passkey ceremony sequence.
- No redesign of the landing page, authenticated app header, household onboarding, or unrelated shared cards.
- Browser- and operating-system-owned passkey prompts remain native; R1 applies to app-owned screens.
- No new decorative animation or visual identity; detailed spacing and control styling follow R2–R3 during planning.

### Outstanding Questions

- Spacing, responsive widths, control treatments, and step wording are resolved by KTD1, KTD3, and the explicitly unconfirmed styling assumptions below.
- Header treatment during authenticated optional enrollment is resolved by KTD2.

### Sources / Research

- User-supplied mobile screenshots of email entry and device-passkey confirmation; confirmed choice of direction C and simplified header.
- `src/routes/login.tsx:224–267`: current app-owned steps, feedback, and focus behavior.
- `src/routes/login.module.css:1–63` and `src/styles/clay.module.css:3–95`: current authentication composition and clay treatments.
- `src/components/Header.tsx:143–178`: public identity, theme control, and authentication entry links.
- `src/styles.css:1–28,200–220,391–395,491–493`: theme palettes and typography.
- `src/routes/api/auth/verify.tsx:17–54`: email-link verification and recovery surface.
- `src/lib/post-auth-router.ts:39–109`: existing invitation, item-intent, onboarding, and return-destination precedence.

---

## Planning Contract

**Product Contract preservation:** Product Contract unchanged in scope; R1–R11, F1–F4, and AE1–AE5 retain their meaning and IDs. The two planning questions now point to their resolutions.

**Depth:** Standard. The change is presentational, but the session transition and shared header require interaction regression coverage.

### Key Technical Decisions

- KTD1. **Share authentication CSS, keep state in the existing routes.** Create `src/styles/auth.module.css` for page, column, heading, controls, and feedback treatments used by login and email-link recovery, replacing their enclosing card classes per R1–R3. Keep login-specific code typography in `src/routes/login.module.css`; remove obsolete recovery CSS after its imports are migrated. This is smaller than introducing a configurable form framework and prevents the two surfaces drifting. (session-settled: user-directed — chosen over focused-card and page-welcome-plus-task-card compositions: the user preferred open, card-free authentication.)
- KTD2. **Select the authentication header by pathname before session-based header rendering.** In `src/components/Header.tsx`, treat exactly `/login` and `/api/auth/verify` as authentication surfaces, allowing the router's trailing-slash form without matching unrelated `/api/auth/*` endpoints. These surfaces render the existing home-linked brand and `ThemeToggle` only, including after session invalidation during enrollment, per R4. Reuse the header's safe-area and height rules and use a non-heading brand wrapper so the task owns the page h1. Keep hooks unconditional and retain existing public/authenticated rendering elsewhere. (session-settled: user-directed — chosen over the public header: remove duplicate entry CTAs and keep attention on authentication.)
- KTD3. **Derive presentation from current login state without adding a second state machine.** Use the current `household`, `request`, and `options` branches to choose one task h1 and its explanation, per R5–R8. Retain handler boundaries, lock/operation guards, capability detection, timers, disabled conditions, and the explicit prepare-then-device-gesture sequence. A layout refactor must not remount `LoginComponent` when the session changes. (session-settled: user-approved — chosen over expanding authentication behavior: retain the existing methods, sequence, and destinations.)
- KTD4. **Make focus follow the rendered task.** Retain email/code input focus and enrollment heading focus, and extend the same focused-heading pattern to the ready device-passkey task per R11. Return focus to the email field on fallback; restore enrollment-heading focus when registration options disappear. Trigger focus on task changes, not busy/error updates or each countdown tick. Keep pending/offline status and error alerts in the shared content column.
- KTD5. **Constrain changes to presentation and route-aware header selection.** Use the existing service mocks and route-test conventions for behavioral proof. Keep authentication services, schemas, root guards, and `resolvePostAuthDestination` as existing dependencies rather than refactoring them to support styling, per R8. A bake-off is unnecessary: the alternatives here are reversible CSS/component-local choices, not competing persistent interfaces or ownership models.

### Assumptions

The following are agent-selected presentation defaults, not additional user-confirmed product requirements.

- **Geometry:** Use a 28rem maximum content width, full width within 1.5rem mobile gutters, and a fixed top inset of 2rem below the existing header on mobile and 4rem at desktop widths. Allow normal document scrolling and safe-area bottom padding; avoid fixed heights, viewport-centered alignment, and keyboard-dependent recentering. These are starting values for browser refinement under R3.
- **Typography:** Left-align the task, use the existing Fraunces heading family at approximately 2rem and Manrope body/control text at 1rem, and use the existing spacing scale for 0.5rem label gaps, 1rem field/action gaps, and 1.5rem task groups. Do not retain the welcome emoji or puffy-text treatment as the task heading.
- **Controls:** Use local auth classes rather than changing shared clay styles. Primary actions use lagoon fill with a dark ink foreground that remains dark in both themes, with rounded corners derived from `--radius-base` and restrained `--elevation-surface`. Alternatives use transparent or lightly surfaced treatments and `--sea-ink`/`--lagoon-ink` text. Inputs use `--surface-strong`, a visible border derived from semantic ink, and a clear focus outline; the low-opacity `--line` alone is not sufficient evidence of a visible input boundary. Use at least 44px control targets and 16px input text.
- **Contrast:** Check normal text at 4.5:1 and control boundaries/focus at 3:1 against adjacent surfaces in both themes. Derive auth-local color treatments when an existing token pair fails; do not change global tokens to fix this surface. Keep disabled text readable instead of reducing the opacity of the entire form. Error text may need a darker light-theme treatment than the current `--danger` value.
- **Copy:** Use the task matrix below as the initial wording. Preserve the existing actionable error details, retry countdowns, expiry guidance, optional-setup explanation, and signed-in reassurance rather than shortening away recovery information.
- **Surrounding shell:** Header simplification is limited to KTD2. Existing root-level offline feedback, signals, bottom navigation, and add-item infrastructure keep their current session-driven behavior; allow for their occupied space in visual checks. Any broader authenticated-shell redesign would require a scope decision.

### High-Level Technical Design

**Ownership sketch**

| Owner | Input / directed relationship | Responsibility |
|---|---|---|
| `src/routes/__root.tsx` | Route context → Header and mounted Outlet | Keeps the route mounted as session context refreshes |
| `src/components/Header.tsx` | Current pathname → auth header or existing session branch | Chooses chrome without changing session state |
| `src/routes/login.tsx` | Existing state → task content → auth CSS | Owns forms, requests, WebAuthn gestures, focus, and feedback |
| `src/routes/api/auth/verify.tsx` | Failed loader result → recovery content → auth CSS | Owns recovery link and preserved intent |
| `src/styles/auth.module.css` | Shared presentation → login and recovery | Provides one open layout and control hierarchy |

**Task/state sketch and initial wording**

Apply the rows in existing render-branch order; pending feedback decorates the current task rather than becoming a separate step.

| Existing condition | Task h1 | Instruction | Dominant action | Subordinate actions / next transition |
|---|---|---|---|---|
| `household !== null`, no registration options | You’re signed in | Next time, use a passkey to sign in with your device. Setup is optional; email codes still work. | Set up passkey, when supported | Continue without a passkey → existing destination; preparation → next row |
| `household !== null`, registration options ready | Create your passkey | Confirm on your device to finish optional setup. | Create passkey on this device | Continue without a passkey → destination; success → destination; failure → enrollment with signed-in reassurance |
| No enrollment, authentication options ready | Sign in with your passkey | Your device is ready to check for a passkey. | Use device passkey | Use email code instead → email; success → destination; failure → email with feedback |
| No enrollment/options, code request present | Check your email | Enter the six-digit code sent to the displayed email, then return to this app. | Verify code | Resend code with current cooldown; Change email → email entry |
| No enrollment/options/request | Sign in to Eggspedition | Use an email code to reconnect to your household list. | Send email code | Sign in with a passkey, when supported → prepare options |
| Email-link loader returns recovery | This sign-in link is unavailable | Existing invalid-or-expired explanation and email-code recovery guidance | Request an email code | `/login` with existing intent, excluding token |

On unsupported devices the enrollment task has no setup CTA; continuing without a passkey becomes its sole dominant action. This applies R6 without introducing a new action or changing R8.

### Behavior Trace and Research

- `LoginComponent` verifies a code, sets `household`, clears options, and invalidates session context in place before optional enrollment. `RootComponent` keeps its Outlet mounted. Selecting the header by session alone would therefore change chrome mid-flow (`src/routes/login.tsx`, `src/routes/__root.tsx`).
- Passkey preparation fetches options; only the next device-button gesture starts the browser ceremony. Cancellation increments the operation guard, aborts the ceremony, and clears options. Preserve both this activation boundary and late-result suppression (`src/routes/login.tsx`; covered in `src/routes/-login.test.tsx`).
- Session loss resets enrollment and aborts in-flight operations. Simplifying the header removes its account menu on auth routes under R4, but does not justify removing the session-loss cleanup or the regression that simulates a context refresh.
- Email-link success redirects through the shared destination resolver; failed verification renders recovery. The recovery link deliberately excludes `token` and forwards the remaining intent (`src/routes/api/auth/verify.tsx`).
- Existing tests cover issuance errors, cooldowns, verification outcomes, unsupported/offline devices, passkey cancellation, stale responses, and destination intent. Extend these tests for changed presentation instead of duplicating the service suite (`src/routes/-login.test.tsx`, `src/lib/post-auth-router.test.ts`).
- Theme tokens, spacing, heading fonts, and safe-area header geometry already exist in `src/styles.css` and `src/components/Header.module.css`. The current shared clay input removes its border and outline; auth-local styles must restore them rather than assuming the shared class provides focus visibility.

### System-Wide Impact and Risks

- **Session/header integration:** The header route branch must win for both household and no-household sessions. Existing public and authenticated headers remain selectable on other routes; regression tests cover those boundaries.
- **Native prompts:** Preserve the user-gesture boundary and cancellation callbacks under KTD3; visual changes cannot establish native passkey correctness without a real device/browser smoke check.
- **CSS leakage:** Use the dedicated CSS module rather than editing `src/styles/clay.module.css` or global tokens. Recovery must relinquish its old full-viewport centered card styling.
- **Focus and announcements:** Do not remount live regions or move focus during busy/error updates. A failed code attempt leaves the code input usable; no new automatic retry or timer announcement is needed.
- **Root shell during enrollment:** Session-driven navigation may appear after verification. Keep this behavior under the surrounding-shell assumption and verify that it does not obscure the form, skip action, or feedback at short heights.

### Sequencing and Deferred Implementation Details

Deliver U1 first; U2 and U3 then share its styles and can be implemented independently. Complete their browser verification together.
Final CSS selector names, small spacing adjustments, and the exact accessible focus-border colors depend on rendered proof; they may change within R1–R7 without reopening product scope.
No new dependency, migration, provider, or environment configuration is required.

---

## Implementation Units

### U1. Present login tasks in the open authentication layout

**Goal:** Make each login step readable and visually consistent while retaining the existing flow.

**Requirements:** R1–R3, R5–R9, R11; F1–F3; AE1–AE5; KTD1, KTD3–KTD5.

**Dependencies:** None.

**Files:** Create `src/styles/auth.module.css`; modify `src/routes/login.tsx`, `src/routes/login.module.css`, and `src/routes/-login.test.tsx`.

**Approach:**
1. Replace the enclosing clay card and repeated welcome heading with a stable shared column and task-specific h1 using the task matrix.
2. Apply shared primary/secondary/input/feedback classes and retain login-specific numeric-code styling. Follow the presentation assumptions for initial geometry and colors.
3. Update task-change focus targets under KTD4 without modifying request handlers or their disabled/cancellation rules.
4. Update the existing test helper's welcome-heading expectation and extend task/focus assertions around existing flow tests.

**Patterns to follow:** Existing route-excluded `-login.test.tsx` convention, service/browser mocks, status/alert roles, and input attributes in `LoginComponent`.

**Execution note:** Preserve existing behavioral tests; use browser rendering to judge geometry and color rather than CSS-class snapshot tests.

**Test scenarios:**
1. Covers F1 / AE1. Request a code from email entry and assert the task heading changes to Check your email, there is one task h1, and the code input receives focus with its numeric/autofill/length attributes retained.
2. Covers F2 / AE2. Prepare returning-passkey options and assert the ready-task heading receives focus and no browser ceremony starts before Use device passkey is clicked; fallback restores email-field focus.
3. Covers F3 / AE3. Verify an email code and assert enrollment-heading focus, retained optional skip, and no early navigation; retain existing invitation/item/no-household destination cases for skipping and registration results.
4. Covers AE4. Trigger validation and a failed verification and assert alert feedback remains present and the active input remains usable; pending updates do not steal task focus.
5. Covers AE5. Retain cooldown, delivery-failure, offline, unsupported-device, stale-response, cancellation, and session-loss regressions after updating heading selectors. When passkeys are unsupported after verification, skip remains the available continuation.

**Verification:** Existing login regressions and new semantic/focus assertions pass; browser checks establish the open composition, heading position, action hierarchy, and input contrast across all task rows.

### U2. Keep authentication header chrome stable across session changes

**Goal:** Show focused authentication navigation throughout login and recovery.

**Requirements:** R2–R4, R8; F1–F4; AE4; KTD2, KTD5.

**Dependencies:** U1 for combined visual verification; header changes otherwise stand alone.

**Files:** Modify `src/components/Header.tsx` and `src/components/Header.module.css`; create `src/components/Header.test.tsx`.

**Approach:**
1. Add the route-selected header branch under KTD2, reusing the existing logo and theme control without a second header in the route.
2. Give its compact row only auth-scoped styling and preserve the existing height/safe-area contract.
3. Exercise route and session combinations in a component test using mocked router/session/query/online dependencies, without invoking real logout or storage clearing.

**Patterns to follow:** Existing Header router-state access, logo link, `ThemeToggle`, and CSS-module structure; use the local jsdom mocking conventions from `src/routes/-login.test.tsx`.

**Test scenarios:**
1. On `/login`, signed out, assert home-linked Eggspedition and theme control are available and marketing, sign-in, start-list, sync, and account-menu actions are absent.
2. Rerender that same header after session context changes to authenticated, both with and without a household, and assert the same auth chrome remains.
3. On `/api/auth/verify` and the supported trailing-slash forms, assert auth chrome; ensure an unrelated `/api/auth/*` path is not classified as an auth screen by a prefix match.
4. Navigate away from an auth path and assert the existing signed-out public links or signed-in household/account controls return as appropriate.

**Verification:** Header selection tests pass and browser navigation confirms a single header with no duplicate entry CTAs during optional enrollment.

### U3. Align invalid email-link recovery with the authentication layout

**Goal:** Give failed email links the same themed recovery surface and preserve their destination intent.

**Requirements:** R1–R4, R8–R11; F4; AE4–AE5; KTD1, KTD4–KTD5.

**Dependencies:** U1's shared CSS and U2 for complete header verification.

**Files:** Modify `src/routes/api/auth/verify.tsx`; remove `src/routes/api/auth/verify.module.css` once unused; create `src/routes/api/auth/-verify.test.tsx`.

**Approach:**
1. Replace the recovery card with the shared main/column/task presentation, including `main-content` for the existing root skip link and a task h1.
2. Keep the loader and recovery-link destination unchanged under R8 and R10. Announce the failed-link feedback and focus the recovery heading on entry without repeated focus on rerenders.
3. Test the recovery route using the current route-mocking style; keep the new test filename route-excluded.

**Patterns to follow:** Existing token-exclusion destructuring, intent forwarding, and `resolvePostAuthDestination` handoff in the route.

**Test scenarios:**
1. Covers F4 / AE5. An invalid/expired loader result renders the unavailable-link task with announced guidance and Request an email code targeting `/login`.
2. Give recovery a token plus invitation, returnTo, and full item intent; assert the recovery link preserves intent and excludes the token.
3. Covers AE4. On recovery entry, assert the heading receives focus, the main landmark matches the skip-link target, and the recovery action remains keyboard reachable.
4. Retain a loader-level success case showing replacement navigation uses the existing resolver destination; presentation refactoring does not turn successful links into recovery.

**Verification:** Recovery tests pass; browser checks show the same column geometry and simplified header in both themes, with no old 100vh/card layout or overflow.

---

## Verification Contract

Automated checks below are execution gates, not evidence that tests have already run.

- **Targeted interaction coverage:** Use the repository's `bun run test` script with the login, Header, and recovery test paths named in U1–U3. This script runs Vitest through Varlock; use the existing local environment setup.
- **Behavior preservation:** Run the existing full `bun run test` suite, including `src/lib/post-auth-router.test.ts` and authentication/service coverage, after the integrated change. Report environment-blocked integration coverage accurately rather than treating it as passed.
- **Static/build gate:** Type-check with the existing TypeScript project configuration and run `bun run build`. No `release:validate` or lint script is declared in `package.json`.
- **Browser visual matrix:** Check email, code, returning-passkey ready, enrollment offer, registration ready, and failed-link recovery at 320px, 390px, 768px, and 1440px widths in light and dark themes. Compare the top heading location across steps at each viewport; ensure zero horizontal overflow, readable long emails, and normal vertical scrolling.
- **Keyboard/short-height matrix:** Test Tab/Shift+Tab, skip-to-content, visible focus, error announcements, autofill/paste, 200% zoom, and a focused input with a mobile keyboard or equivalent reduced available height. Buttons, skip, and recovery guidance must remain reachable below sticky header and session-driven bottom chrome.
- **Action/state matrix:** Inspect one dominant action in each task, disabled readability, offline recovery, resend cooldown, wrong/expired code feedback, and passkey cancellation. On unsupported devices inspect the enrollment continuation hierarchy.
- **Native smoke:** In a WebAuthn-capable browser/device, verify explicit preparation followed by a device gesture for sign-in and registration, cancellation to the existing app fallback, and optional skip. Mocked tests alone do not prove native prompt behavior.
- **Routing/header integration:** Exercise session invalidation during enrollment, a household and a no-household account, and return to normal public/authenticated routes. Include invitation and item-intent destinations from existing tests. Use safe local fixtures for invalid-link recovery.
- **Evidence:** Record screenshots for representative mobile/desktop themes and note the browser/native-smoke outcomes in the delivery review. Styling needs rendered proof; extra DOM snapshots do not establish R2–R3 or R6–R7.

---

## Definition of Done

- U1's task/focus assertions, U2's route/session header assertions, and U3's recovery/intent assertions pass with the existing behavioral regressions.
- Browser evidence satisfies AE1–AE5 and the visual, contrast, keyboard, and short-height matrices in the Verification Contract.
- The Product Contract's methods, sequence, cancellations, retry restrictions, and destinations remain intact under R8–R10.
- Shared auth styles cover login and recovery without changing unrelated cards, global theme tokens, or other routes' header behavior.
- Static/build gates pass and any environment-limited verification is reported with its consequence.
- Unused recovery/card styles, stale imports, abandoned experiments, and temporary sketch code are removed from the final diff.
