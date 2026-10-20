---
title: PWA Passkey and Email Code Sign-In - Plan
type: feat
date: 2026-10-20
topic: pwa-passkey-sign-in
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# PWA Passkey and Email Code Sign-In - Plan

## Goal Capsule

- **Objective:** An iPhone or iPad shopper can regain access through their existing home-screen app without deleting and reinstalling it.
- **Means:** Passkey sign-in, entered email codes, and bounded renewal of remembered sessions.
- **Product authority:** The Product Contract below records the scope confirmed by the user on 2026-10-20; requirements are the authority for behavior and acceptance.
- **Open blockers:** None for implementation planning; device coverage and implementation questions are recorded under Dependencies / Assumptions and Outstanding Questions.
- **Execution profile:** Four serial units, U1 → U2 → U3 → U4, in the existing checkout. The implementation caller owns completion and verification; shipping requires separate authority.
- **Stop conditions:** Escalate a conflict with the Product Contract or an inability to preserve existing identities, session deadlines, or offline list behavior.

---

## Product Contract

### Summary

Replace newly issued email magic links with code entry inside the installed app, and offer optional passkey enrollment after authentication.
Returning shoppers can use their device authenticator, with email codes as a complete fallback.
Remembered sessions renew within the agreed lifetime policy.

### Problem Frame

The user reports authenticating in the browser before installing the PWA, then repeating that process and removing the old installation whenever access is lost.
This turns a routine return to the shopping list into a browser and installation task.

The current implementation emails clickable magic links rather than numeric OTPs.
Verification establishes a session in the context handling that link.
Ordinary authenticated use does not renew the fixed session lifetime, and the signed-out root shows a marketing landing page with installation guidance.
The reported reinstall workaround is real user evidence; its exact device-level cause has not been reproduced.

### Key Decisions

- **Replace the normal magic-link journey.** Governs R2–R4, R8–R9. (session-settled: user-approved — chosen over continued clickable email sign-in: the user selected passkeys and entered codes after reviewing the PWA handoff tradeoffs.)
- **Focus acceptance on the iPhone/iPad home-screen app.** Governs R1. (session-settled: user-directed — chosen over adding Android and desktop acceptance coverage: the user selected iPhone/iPad PWA.)
- **Keep passkey enrollment optional.** Governs R6. (session-settled: user-directed — chosen over requiring enrollment on supported devices: users must be able to skip setup and continue with email codes.)
- **Include remembered-session renewal.** Governs R10–R11. (session-settled: user-directed — chosen over retaining fixed monthly expiry: the user wants regularly used devices to ask less often.)
- **Bound remembered access using the agreed policy.** Governs R10. (session-settled: user-approved — chosen over shorter or longer limits: the user accepted the proposed balance between continuity and fresh authentication.)
- **Treat device sign-in as the device authenticator, not device-to-device approval.** Governs R7–R8; cross-device approval is deferred. (session-settled: user-approved — chosen over adding a separate approval flow: the user confirmed this scope boundary.)

### Requirements

**Installed-app recovery**

- R1. The supported acceptance surface is Eggspedition installed from Safari onto the Home Screen on iPhone and iPad.
- R2. A signed-out or expired installation must offer a working sign-in journey through the existing icon, without requiring browser-first authentication or reinstallation.
- R3. Completing authentication must restore the existing account and household membership when that identity already exists.
- R4. Reauthentication must preserve the supported invitation, add-item, or validated return destination that initiated it.

**Email codes and passkeys**

- R5. A user must be able to request and enter a short-lived, single-use email code in the installed app, subject to the existing admission restrictions and bounded verification attempts.
- R6. After successful authentication, offer optional passkey setup; skipping or cancelling setup must leave the user able to enter their list and use email-code sign-in later.
- R7. An enrolled passkey must authenticate its existing account through the device authenticator without requiring email in the successful returning-sign-in path.
- R8. If passkey authentication is unsupported, unavailable, declined, or unsuccessful, the user must be able to continue with email-code sign-in in the same installation.
- R9. Newly issued sign-in emails must use entered codes instead of clickable authentication links; a wrong, expired, or consumed code must not authenticate the user and must leave a clear retry, resend, or change-email path.

**Remembered sessions and signout**

- R10. Successful authenticated use must renew remembered access until either 30 days of inactivity or 90 days since the last fresh sign-in, whichever occurs first; renewal alone must not reset the fresh-sign-in deadline.
- R11. Explicit Sign out must end the installation’s current session and require fresh authentication before protected access resumes.

### Key Flows

- F1. Sign in using email and optionally enroll
  - **Trigger:** The shopper opens an installation without a valid session.
  - **Steps:** Enter email, request a code, read the email, return to the same app, enter the code, and complete authentication; then accept or skip optional passkey setup.
  - **Outcome:** Reach the existing household or supported post-auth destination under R3–R6 and R9.

- F2. Return using a passkey
  - **Trigger:** A fresh sign-in is needed and the account has an available passkey.
  - **Steps:** Request passkey sign-in and complete the device’s verification prompt.
  - **Outcome:** Resume the supported destination under R4 and R7; if verification cannot finish, take the email-code path under R8.

- F3. Continue using a remembered session
  - **Trigger:** The shopper uses the app while their session remains eligible for renewal.
  - **Outcome:** Access continues under R10 without requiring a special renewal action; reaching either boundary returns to F1 or F2 through the same icon under R2.

- F4. Sign out and return
  - **Trigger:** The shopper explicitly chooses Sign out.
  - **Outcome:** Protected access ends under R11; opening the existing icon offers F1 or F2 under R2.

### Acceptance Examples

- AE1. First code sign-in and skipped enrollment
  - **Covers R1–R3, R5–R6, R9.** An admitted shopper requests a code from the home-screen app, reads it in their mail client, returns to that app, and authenticates without following a sign-in link; declining passkey setup still reaches their list.

- AE2. Existing member adopts a passkey
  - **Covers R3, R6–R7.** An existing member authenticates with an email code and accepts enrollment; later passkey authentication returns the same account and membership, rather than creating another member.

- AE3. Passkey is unavailable or cancelled
  - **Covers R2, R8–R9.** The shopper cannot finish the device prompt or has no usable passkey; they can choose email code and complete sign-in through the original installation.

- AE4. Code verification fails
  - **Covers R5, R9.** A wrong, expired, or already consumed code does not grant access; the shopper can recover through the code-entry journey without deleting the app or opening an authentication link.

- AE5. Admission restrictions still apply
  - **Covers R5.** An email that the current admission rules reject does not gain access through code issuance or verification.

- AE6. Active use crosses the old monthly boundary
  - **Covers R10.** A shopper who remains active within the policy continues using their list beyond the previous fixed expiration, without a special renewal step or an extension past the fresh-sign-in deadline.

- AE7. Inactivity and maximum lifetime end remembered access
  - **Covers R2, R7–R8, R10.** At either policy boundary, remembered access requires fresh authentication through the same installation; activity-based renewal cannot bypass the maximum lifetime.

- AE8. Explicit logout does not silently undo itself
  - **Covers R2, R11.** After Sign out, the existing icon opens a signed-out recovery path; protected access does not resume merely because the app reloads.

- AE9. Interrupted invitation or item action resumes
  - **Covers R3–R4.** Authentication interrupts an existing supported invitation or add-item journey; successful code or passkey sign-in resumes that intent with the existing account and current onboarding rules.

### Scope Boundaries

- Android and desktop-specific acceptance coverage is deferred; this does not require deliberately disabling those environments.
- Device-to-device approval, household-assisted account recovery, social sign-in, passwords, and emergency recovery keys are outside this change.
- Email-address replacement, account merging, and a general credential/device-management dashboard are outside this change.
- A general offline-authorization redesign and cache-reset feature are not part of this scope; any change necessary for R2 must preserve the app’s existing offline-use expectations.
- This contract does not assume that cookie isolation or stale cached pages caused the reported reinstall loop.

### Dependencies / Assumptions

- Passkey behavior must be validated in an actual iPhone/iPad home-screen context; documentation support alone does not establish that R1–R2 work on the target devices.
- The user did not provide OS versions; planning must identify and record the practical device/version test coverage rather than claim all historical iOS/iPadOS releases are supported.
- Email delivery remains a dependency for initial sign-in and passkey fallback.
- A trusted route into the existing account is necessary before attaching a passkey; successful authentication for a different identity must not be treated as permission to link credentials to that account.
- The existing framework, domain-service boundaries, validation conventions, styling, and household onboarding behavior remain project constraints.

### Outstanding Questions

**Deferred to Planning**

- Choose the passkey implementation and deployment configuration that can satisfy R1, R3, and R7 without changing the confirmed product scope.
- Set code length, expiry, resend cadence, and issuance/verification limits that satisfy R5 and R9; determine how resends and concurrent requests are reconciled.
- Define the authenticated activity and renewal mechanism used to enforce R10, including consistent handling across the app’s session-issuing paths.
- Determine how to preserve compatible existing sessions and safely transition any previously issued magic links while ending new link issuance under R9.
- Identify any navigation or cache changes needed for R2 and select real-device verification coverage for R1.

### Sources / Research

- `docs/ideation/2026-10-20-pwa-authentication-ideation.html` — compared sign-in alternatives and separated interruption frequency from reauthentication effort.
- `src/routes/login.tsx:29–82` and `src/services/auth.api.ts:47–60` — existing magic-link UI and callback-local cookie establishment.
- `src/lib/auth-utils.ts:8–22` and `src/services/auth.api.ts:6–20` — current fixed session lifetime and non-renewing session reads.
- `src/services/household.api.ts:18–31,81–94` — other paths that reissue sessions.
- `src/db/schema.ts:3–31` and `src/services/auth.service.ts:110–123,166–182` — durable account identity, email admission gate, and membership restoration.
- `public/manifest.json:6–8`, `src/routes/index.tsx:54–59`, and `src/components/landing/LandingPage.tsx:187–189` — standalone launch and signed-out installation messaging.
- `public/sw.js:73–89` — navigation-cache behavior relevant to same-install recovery, not proof of the runtime cause.
- `src/lib/post-auth-router.ts:40–108` — existing invitation, add-item, onboarding, and return routing to preserve.
- [MDN Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API) and [client capability detection](https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential/getClientCapabilities_static) — current documentation checked through Context7 during ideation; actual target-device behavior remains to be verified.

---

## Planning Contract

**Product Contract preservation:** Product Contract unchanged. Its deferred planning questions are resolved below; the original questions remain as provenance.

### Key Technical Decisions

- KTD1. **Keep authentication in domain services with thin server-function adapters.** Extend `auth.service.ts` for email and identity resolution, add `passkey.service.ts` for ceremonies and `session.service.ts` for remembered-session state. Adapters own cookies, request-origin checks, private/no-store response headers, and Zod validation; services own database transactions and policy. Shared identity/session operations accept the caller's transaction, rather than using a second global connection inside it: `src/db/index.ts` currently limits its pool to one connection. Commit failed-attempt increments and consumed challenge claims even when returning a domain rejection; do not throw an error that rolls those protections back. This follows `household.service.ts` / `household.api.ts` and avoids coupling security rules to React. Covers R3–R11.
- KTD2. **Use SimpleWebAuthn's current stable server and browser packages through Bun.** Registry `latest` on 2026-10-20 is `@simplewebauthn/server` 14.0.3 and `@simplewebauthn/browser` 14.0.0; use these compatible v14 releases and preserve the resolved versions in `bun.lock`. Use the v14 `optionsJSON` browser interface and server `credential` verification interface. Keep the server package out of client bundles. Handwritten WebAuthn verification would add cryptographic and serialization work without a local pattern to justify it. Official v14 docs list Node/Deno, so Bun compatibility is an execution smoke-test requirement, not a claimed upstream guarantee. Covers R6–R8.
- KTD3. **Replace new links with durable six-digit codes.** Generate zero-padded codes with a cryptographically secure random integer, expire after 10 minutes, allow five failed submissions per generation, and enforce a 60-second resend delay, three issuances per rolling 15-minute window and ten per rolling 24-hour window per normalized email. Store issuance timestamps, attempt count, expiry, generation ID, binding digest, and a domain-separated HMAC of email + generation + code using `AUTH_SECRET`; never store or log plaintext codes. Serialize issuance and verification on a Postgres row keyed by normalized email, including the initially absent-row case. A resend rotates the generation and invalidates its predecessor without resetting issuance history. A correct submission atomically consumes the generation, resolves the user, and creates the fresh session; concurrent submissions cannot both succeed. SMTP is outside the transaction: delivery failure invalidates only its own generation and returns a retryable delivery result while retaining issuance accounting. The existing process-local rate-limit Map is insufficient across restarts and replicas. Covers R5, R9.
- KTD4. **Bind both code and WebAuthn exchanges to the initiating installation.** An opaque random HttpOnly, SameSite=Lax, root-path ceremony cookie, Secure in production, supplies a browser-binding secret; keep it separate from the session cookie and refresh its 15-minute lifetime when beginning a ceremony. Persist only its digest in code/challenge records. Return an opaque request ID alongside options or code status, and require ID plus matching cookie at finish. WebAuthn challenges expire after five minutes, record registration/authentication purpose, expected origin/RP ID, and registration user/session IDs, and permit one atomic finish claim even when verification fails. Recheck the registration session at finish. Reject mismatched purpose, binding, origin, account, or expiry before credential attachment or session issuance. New auth POST adapters require same-origin requests against configured `BASE_URL`; retain the legacy GET callback only for existing links. This closes login/account-linking confusion without relying on challenge secrecy in client storage. Covers R3, R5–R9.
- KTD5. **Register discoverable, user-verified passkeys against the existing user ID.** Use UTF-8 bytes of the user's stable UUID as the WebAuthn user handle, not email. Registration requires authentication, `residentKey: required`, `userVerification: required`, platform attachment, and no attestation; exclude that user's existing credential IDs. Authentication omits account input and `allowCredentials`, requires user verification, looks up the globally unique credential ID, and verifies its user handle against its owner. Persist public key as base64url text with an explicit Uint8Array conversion at the library boundary, counter as bigint in number mode, transports as a JSON string array, device type, backup state, and creation/last-use timestamps. Persist the library-verified counter update in the same transaction as the challenge claim and new session, locking the credential row to prevent lost updates. Accept the library's zero-counter behavior for synced passkeys rather than inventing strict increment rules. Never reassign a duplicate credential to another user. Covers R3, R6–R8.
- KTD6. **Derive one exact WebAuthn origin and RP ID from validated `BASE_URL`.** Expected origin is the URL origin and RP ID is its hostname, without scheme, port, or path; RP display name is Eggspedition. Production requires HTTPS; localhost HTTP is the development exception. Never derive trust from the incoming Host header. A stable deployment hostname is required because changing RP ID invalidates existing credentials. No separate RP configuration or multi-origin support is needed for the current single-origin app. Document this in `.env.schema` and `README.md`. Covers R1, R7–R8.
- KTD7. **Make server-side session records authoritative and keep `session_token` as the signed transport.** Each fresh code/passkey/legacy-link sign-in creates a random session ID with user ID, authenticated-at, last-activity-at, inactivity expiry, absolute expiry, and revoked-at. JWT claims include the session ID and authenticated-at alongside existing identity/household claims; its expiry and cookie lifetime equal the earlier server deadline under R10. Successful authenticated session reads and admitted protected/auth-only requests touch activity and renew the transport; failed authentication, static/cache-only activity, and SSE keep-alive frames do not. No renewal timer is added. All readers use one session resolver, and every household reissue preserves session ID and authenticated-at while changing only household context. Atomic renewal must never clear revocation or move the absolute deadline. Logout revokes the record before clearing cookies, so a late in-flight renewal cannot restore protected access. The durable row is justified by the new renewal/logout race, which a cookie deletion alone cannot close. Covers R10–R11. (session-settled: user-approved — chosen over retaining fixed monthly expiry: the user accepted bounded renewal to reduce repeat sign-ins.)
- KTD8. **Adopt valid legacy JWTs without resetting their age.** Verify the existing signature and expiry before adaptation, preserve the original JWT `iat` as authenticated-at, and create/find a durable session using a unique domain-separated token digest. Retain a revoked legacy digest through its original validity so concurrent adoption cannot recreate a logged-out session. Missing or invalid `iat` fails closed. Adoption is possible only while the old cookie is valid and sets subsequent deadlines from KTD7, not the adoption time. Keep `magic_links` and `/api/auth/verify` consumable for each already-issued link's remaining 15-minute validity, using an atomic delete-and-return claim within account/session creation. Remove all new link issuance and change expired-link copy to request an email code. No destructive schema cleanup belongs in this release. Covers R3, R9–R11.
- KTD9. **Use the existing post-auth destination resolver for every successful sign-in.** Carry `returnTo`, `invite`, `name`, `quantity`, `category`, and `store` through login and the optional enrollment step. Validate return paths through `return-intent.ts`; do not treat client routing intent as account or membership authority. Determine household presence from the latest existing membership, as current authentication does. Resolve users by normalized email while preserving existing case-variant accounts: prefer a unique case-insensitive existing match, create only if none exists, and reject ambiguous matches rather than merge accounts. Serialize first-account creation on the email issuance row. Admission checks apply at code issuance and completion and passkey completion; legacy links retain their original admission semantics during their remaining validity. Covers R3–R5, R9.
- KTD10. **Provide recovery through `/login` and a visible signed-out entry from the existing root.** Build email → code → optional-enrollment states in the login route, with an explicit passkey button and email fallback. Do not auto-open an authenticator prompt or silently enroll. After code success, invalidate router session context before offering enrollment without navigating away and losing intent; skip, cancel, or failure must continue normally. Keep browser first-visit landing content, but make its Sign in action prominent and show direct recovery in standalone mode after client-side detection. Treat hydration safely. Preserve Query persistence for offline list use. Exclude login and auth callback navigations/RPC responses from service-worker caching and from authenticated root fallback; provide an offline sign-in explanation instead. On confirmed logout, clear cached HTML navigations including `/` through an acknowledged service-worker message, alongside Header's existing query/persistence cleanup. Ensure in-flight pre-logout navigation fetches cannot repopulate those entries after acknowledgement; static assets remain cached. An online reload must fetch current session state. The reported reinstall loop's device-level cause remains unproven. Covers R1–R2, R4, R6–R9, R11.

### High-Level Technical Design

**Ownership and exchange map**

| Stage | Owner | Input and output |
|---|---|---|
| Sign-in UI | `src/routes/login.tsx` | Retains validated navigation intent; sends email/code or invokes the browser authenticator. |
| Auth adapter | `src/services/auth.api.ts` | Validates Zod input and origin, manages binding/session cookies, returns serializable results without JWTs or secrets. |
| Email domain | `src/services/auth.service.ts` | Claims the durable code generation and resolves the admitted existing identity. |
| Passkey domain | `src/services/passkey.service.ts` | Generates bound options, verifies responses, claims challenges and updates credential state. |
| Session domain | `src/services/session.service.ts` | Creates, adopts, renews, reissues, and revokes sessions under KTD7–KTD8. |
| Durable storage | `src/db/schema.ts` | Adds `email_code_requests`, `webauthn_challenges`, `passkeys`, and `auth_sessions`; retains legacy tables. |

**Protocol sketches (directional design)**

- Code: request with email + binding → durable throttle/rotate → mail code → finish with request ID + code + binding → transaction claims code and restores user/membership → session cookie → optional enrollment → resolved destination.
- Registration: authenticated options request → bound challenge with user/session → explicit device gesture → verified response → transaction rechecks session and inserts unique credential → continue to retained destination.
- Returning passkey: anonymous options request → browser authenticator → finish with request ID + assertion + binding → locked credential verification and challenge claim → fresh session for credential owner → resolved destination.

**UI state and branching sketch**

Email entry → requesting → code entry → verifying → optional enrollment → destination.
Code entry can transition to resend, change email, recoverable error, or success.
Passkey entry can transition directly to destination or return to email entry on unsupported/cancelled/failed authentication.
Enrollment can transition to success, skip, or cancellation/error followed by continuation; it never revokes the successful sign-in.

**Session lifecycle sketch**

Fresh authentication → active session → authenticated activity renews inactivity deadline, capped by absolute deadline → either boundary ends access → fresh authentication required.
Legacy verified JWT → adopt once using original issue time → same active lifecycle.
Active session → household reissue retains original clock; active session → logout marks revoked → all subsequent validation fails, including stale renewal responses.

### Assumptions

- Unvalidated deployment bet: `BASE_URL` identifies the actual HTTPS origin used by the installed app. Validate the deployment value during execution; a mismatched hostname is a configuration blocker for passkey acceptance, not grounds to broaden origin trust.
- Unvalidated device bet: acceptance can be run on one physical iPhone and one physical iPad with a current supported iOS/iPadOS release and a configured device authenticator. Record model, exact OS version, install origin, and test date; this does not claim support for every historical release.
- Email limits in KTD3 are planning defaults for this small allowlisted app. They are deliberately durable and bounded; no new IP-trust/proxy configuration, CAPTCHA, or general abuse-management service is included.
- Cached-only offline interaction cannot extend server-observed inactivity. Existing list persistence remains usable according to current offline behavior, and fresh authentication requires a connection.

### Sequencing and System-Wide Impact

Execute U1 → U2 → U3 → U4 serially. The shared schema, session adapters, and login state make parallel authoring more likely to conflict than help.
The checkout contains pre-existing `.gitignore`, `GEMINI.md`, configuration, ideation, and plan WIP; establish the baseline and preserve unrelated work. These units do not grant commit or push authority.

The session integration boundary includes `getSessionServerFn`, all three auth middlewares, household creation, invitation acceptance, **and** `joinHouseholdFn` in `grocery.api.ts`.
Do not change grocery business rules when routing that last cookie write through the shared session interface.
Do not count SSE keep-alive frames as user activity or write cookies after streaming begins.
Private session state and ceremony responses must not become reusable cached authorization.

### Rollout, Risks, and Deferred Details

- Apply additive tables using the repository's existing schema-push deployment path. `docs/database-migrations.md` is explicitly a proposal, not an implemented migration runner; do not assume `db:generate` or `db:check` scripts exist. Validate schema creation and existing data preservation on a disposable Postgres database before release. A migration-system conversion is outside these units.
- Preserve old session cookies and unused magic-link rows through rollout per KTD8. Leave the compatibility consumer in place even after normal issuance stops; removing it can be separate work once no valid old links remain.
- Include bounded deletion of expired ceremony rows and old issuance timestamps when their email/binding is next touched. Keep session revocation/adoption records until no associated transport can remain valid. No new scheduled cleanup service is needed for this app's volume.
- Client support is advisory: missing APIs, a device without a usable credential, or cancellation always leaves email available. Conditional autofill, silent auto-registration, credential-management screens, and WebAuthn Signal APIs are considered and not built because explicit gestures plus email meet R6–R8; revisit only if device evidence shows a missing required flow.
- Deferred to execution: exact SQL/helper names, any TanStack response-cookie integration adjustment, Bun crypto/bundler compatibility, real-device prompt behavior, and the available physical devices' exact OS versions. Resolve these by the verification gates, not by changing product scope.
- There is no remaining product decision blocking implementation. Missing SMTP, disposable Postgres, or physical devices blocks the corresponding verification, not plan enrichment; report that evidence gap explicitly rather than marking acceptance passed.

### Technical Sources

- `src/services/auth.service.ts`, `src/services/auth.api.ts`, `src/lib/auth-utils.ts`, `src/lib/middleware.ts`, `src/services/household.api.ts`, and `src/services/grocery.api.ts` establish the single-pass trace: legacy link issuance/claim → identity/membership → JWT → adapter cookie, with three household reissue paths and no renewal today.
- `src/routes/login.tsx`, `src/routes/api/auth/verify.tsx`, `src/lib/post-auth-router.ts`, `src/lib/return-intent.ts`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/components/Header.tsx`, and `public/sw.js` establish navigation, logout cache clearing, and recovery boundaries.
- `package.json`, `vite.config.ts`, `drizzle.config.ts`, and `docs/database-migrations.md` establish Bun/Nitro, Vitest, and the actual schema rollout path. No existing auth test harness or versioned migrations were found.
- [SimpleWebAuthn v14 server](https://simplewebauthn.dev/docs/packages/server) and [browser](https://simplewebauthn.dev/docs/packages/browser) documentation, checked via Context7 and official pages, govern KTD2, KTD5, and KTD6. Registry metadata confirms [server 14.0.3](https://registry.npmjs.org/@simplewebauthn/server/14.0.3) and [browser 14.0.0](https://registry.npmjs.org/@simplewebauthn/browser/14.0.0).
- No competing mechanism requires a bake-off: current domain-service boundaries and existing Postgres settle storage ownership; the remaining alternatives are implementation tradeoffs documented in KTD1–KTD10.

---

## Implementation Units

### U1. Establish durable remembered sessions and compatibility

**Goal:** Make bounded renewal and logout consistent across every session path before adding fresh authentication methods.

**Requirements:** R3, R10–R11; F3–F4; AE6–AE8. **Dependencies:** None.

**Files:** Modify `src/db/schema.ts`, `src/lib/schemas.ts`, `src/lib/auth-utils.ts`, `src/lib/middleware.ts`, `src/services/auth.api.ts`, `src/services/auth.service.ts`, `src/services/household.api.ts`, and the session-reissue block in `src/services/grocery.api.ts`. Add `src/services/session.service.ts`, `src/lib/session-cookies.ts`, `src/lib/auth-utils.test.ts`, `src/services/session.service.test.ts`, `src/services/session.integration.test.ts`, and `src/test/auth-db.ts`.

**Approach:**
1. Add session persistence and shared validation before changing readers, implementing KTD7–KTD8.
2. Separate fresh session creation from renewal/household reissue in the domain interface; put cookie options and remaining lifetime in one adapter helper.
3. Route every reader and cookie writer through those boundaries, including legacy callback creation and grocery household join.
4. Make revocation authoritative before cookie deletion, without changing Header's existing query-cache cleanup.

**Patterns to follow:** `src/lib/schemas.ts` for Zod-owned session types and `src/services/household.api.ts` for thin adapter/domain separation. **Execution note:** Characterize legacy JWT and household reissue before changing them; use a disposable Postgres connection for persistence/concurrency proof.

**Test scenarios:**
1. Covers AE6. Activity before expiry moves inactivity expiry beyond the old monthly boundary, while authenticated-at and absolute expiry remain fixed.
2. Covers AE7. Exactly at either deadline, access fails; renewal immediately before the boundary cannot exceed the maximum deadline.
3. A valid old JWT adopts with its original `iat`; an expired, tampered, or issue-time-less token fails without a new clock.
4. Household creation, invite acceptance, and grocery household join preserve session ID and authenticated-at while updating household context and cookie lifetime.
5. Covers AE8. Logout followed by concurrent renewal/adoption and a stale-cookie request remains revoked; a later fresh sign-in creates a different valid session.
6. Failed authorization and SSE keep-alive frames do not renew; successful session/authorized request handling does. Separate database connections observe the same expiry and revocation.

**Verification:** Cookie/JWT/server deadlines agree, all legacy entry points remain callable, and race tests demonstrate that logout cannot be undone by renewal.

### U2. Deliver durable email codes and retire new link issuance

**Goal:** Authenticate admitted existing identities with entered codes and preserve old sent links during transition.

**Requirements:** R3–R5, R9; F1; AE1, AE4–AE5, AE9. **Dependencies:** U1.

**Files:** Modify `src/db/schema.ts`, `src/lib/schemas.ts`, `src/services/auth.service.ts`, and `src/services/auth.api.ts`. Add `src/lib/auth-origin.ts`, `src/services/auth.service.test.ts`, `src/services/auth.integration.test.ts`, and `src/services/auth.api.test.ts`; extend `src/test/auth-db.ts`.

**Approach:**
1. Define Zod request/result contracts for request-code and verify-code, with serializable success, invalid/expired/consumed, attempt-limit, admission, delivery, and retry-after results.
2. Implement KTD3–KTD4 using shared normalized identity resolution under KTD9 and session creation under KTD7.
3. Replace `loginServerFn` issuance with request-code output containing request ID, expiry, and resend eligibility; verification accepts request ID and code rather than an asserted account identity.
4. Retain legacy verification through the atomic KTD8 path; remove send-link behavior and template from all normal issuance call sites.

**Patterns to follow:** Existing Nodemailer transporter and admission configuration in `auth.service.ts`; existing server-function validation in `auth.api.ts`. Keep transport failures separate from domain verification outcomes.

**Test scenarios:**
1. Covers AE1 / AE5. An admitted email receives a code-only email and authenticates; a rejected email receives no credential or session, including after admission changes between request and finish.
2. Covers AE4. Leading-zero codes work; wrong, malformed, expired, exhausted, superseded, or consumed submissions never establish a session and return actionable status.
3. Real Postgres concurrent issuance respects resend/window limits across distinct connections and process-local limiter absence; simultaneous correct submissions yield one session.
4. SMTP failure invalidates only that generation, does not refund issuance limits, and cannot invalidate a later successful resend.
5. Covers AE9. Existing mixed-case email resolves to its unique existing user and latest membership; first-time verification creates one user; ambiguous case variants fail without merging.
6. Missing binding, copied request IDs, or cross-origin finish requests fail. Code values and session tokens never appear in returned payloads or logs.
7. A pre-release unexpired magic link succeeds once, including concurrent consumption; its expired counterpart fails. New mail contains no authentication URL.
8. Wrong-code attempt accounting survives a rejected response and reconnect; successful consumption and session creation share one transaction without requiring a second pool connection.

**Verification:** Service and adapter coverage proves persistent limits and replay protection, identity continuity, and compatibility with U1's session deadlines.

### U3. Add account-bound passkey ceremonies

**Goal:** Enroll an optional device passkey and restore its existing account without email entry.

**Requirements:** R3, R6–R8; F1–F2; AE2–AE3. **Dependencies:** U1, U2.

**Files:** Modify `package.json`, `bun.lock`, `src/db/schema.ts`, `src/lib/schemas.ts`, `src/services/auth.api.ts`, `.env.schema`, and generated `env.d.ts` only if schema tooling changes it. Add `src/services/passkey.service.ts`, `src/services/passkey.service.test.ts`, `src/services/passkey.integration.test.ts`, and `scripts/auth-passkey-smoke.ts`; extend `src/lib/auth-origin.ts`, `src/services/auth.api.test.ts`, and `src/test/auth-db.ts`.

**Approach:**
1. Add the KTD2 dependencies through Bun and validate KTD6 configuration through the existing environment mechanism.
2. Add passkey/challenge tables and options/finish adapter contracts under KTD4–KTD5; bind registration to authenticated user/session, not caller-supplied identity.
3. Route successful discoverable authentication through the shared identity/membership and fresh-session interface; never create a user from an assertion.
4. Preserve current package/runtime architecture and return safe serializable results for cancelled/expired/retryable ceremonies.

**Patterns to follow:** U2's request binding, origin validation, and domain error/result boundaries; server-only dynamic imports already used in `auth.api.ts`.

**Test scenarios:**
1. Covers AE2. Register under an authenticated existing user, persist/reload the public key, then verify an actual signed discoverable assertion to recover the same user and membership without email input.
2. Wrong challenge, origin, RP ID, signature, purpose, binding, user handle, unknown credential, or absent user verification produces no session.
3. Registration after logout or under a different session/account cannot attach credentials. Duplicate credential IDs never change owners.
4. Concurrent replay of a finish request yields one success; a consumed/expired challenge requires new options, and the counter update is not lost across connections.
5. Synced zero counters remain valid under the library rules; nonzero-counter rollback is rejected by verification.
6. Covers AE3. Unsupported or rejected ceremonies leave the valid email path available; registration failure does not revoke the authenticated session.
7. Actual installed package imports, option generation, and signature verification run under Bun, including a database serialization round-trip; mocks alone do not satisfy this gate.
8. A failed cryptographic finish permanently consumes that bound challenge without creating a session; its replay fails after reconnect.

**Verification:** Cryptographic fixture verification and Postgres races pass, exact origin configuration is documented, and the client bundle contains no server verification package.

### U4. Complete same-install recovery, intent routing, and device acceptance

**Goal:** Let shoppers complete all sign-in and fallback paths through the existing iPhone/iPad home-screen icon.

**Requirements:** R1–R11; F1–F4; AE1–AE9. **Dependencies:** U1, U2, U3.

**Files:** Modify `src/routes/login.tsx`, `src/routes/login.module.css`, `src/routes/index.tsx`, `src/routes/__root.tsx`, `src/components/landing/LandingPage.tsx`, `src/components/landing/LandingPage.module.css` if its sign-in styling needs adjustment, `src/routes/api/auth/verify.tsx`, `src/components/Header.tsx` only for auth-flow integration, `public/sw.js`, and `README.md`. Modify `src/lib/post-auth-router.ts` / `src/lib/return-intent.ts` only if preserving the existing routing contract requires it. Add `src/routes/login.test.tsx`, `src/lib/post-auth-router.test.ts`, `src/lib/pwa-auth.test.ts`, and `public/sw.test.ts`.

**Approach:**
1. Implement KTD10's state transitions with existing CSS Modules/clay styles, labelled email/code fields, numeric input mode, one-time-code autocomplete, pending/error status, resend countdown, change email, and persistent email fallback.
2. Invoke passkey operations only on an explicit gesture; do capability detection client-side and cancel pending ceremonies on navigation or switching methods. Preserve intent through enrollment and refresh router session context after authentication.
3. Integrate KTD9 navigation with invite/onboarding/add-item behavior; keep legacy callback consumption but replace expired-link recovery wording.
4. Apply narrowly scoped service-worker auth exclusions and cache-version update, retaining list-query persistence and static assets; verify signout followed by offline/online reopen cannot reuse cached authorization.
5. Document email behavior, session policy, stable HTTPS origin, additive schema rollout, and the physical-device verification record.

**Patterns to follow:** `resolvePostAuthDestination`, `validateReturnTo`, existing Header logout cleanup, and `src/styles/clay.module.css`. No new visual design system or browser automation framework is required.

**Test scenarios:**
1. Covers AE1–AE3. Email success offers optional enrollment; skip, cancelled enrollment, and unsupported/cancelled/failed passkey login retain email and reach the appropriate existing account destination.
2. Covers AE4–AE5. Error/resend/change-email states remain usable, carry server retry deadlines, and never claim authentication after failure or repeated taps.
3. Covers AE9. Invite return, add-item with category/store/quantity, no-household onboarding, and validated return paths survive code and passkey authentication plus enrollment. External/open-redirect inputs remain rejected.
4. Covers AE8. Signout revokes the session, clears existing cached user queries and HTML navigations, and invalidates routing; offline reopening `/` or an auth route cannot restore the pre-logout document, including when a pre-logout fetch finishes late.
5. Auth navigations and server-function GET responses bypass service-worker cache; static assets and persisted list data still support the existing offline experience. Online reload shows live signed-out or signed-in state.
6. Covers AE1–AE9. On physical iPhone and iPad installed from Safari, read mail and return to the same icon, enroll and reuse the local passkey, cancel and recover, sign out/reopen, and resume an interrupted intent without reinstalling.

**Verification:** Component/routing/cache tests pass and real-device evidence records both target surfaces. Desktop emulation or a WebAuthn mock does not establish R1.

---

## Verification Contract

These are execution gates, not commands run during planning.
There is only one existing Vitest test file (`src/lib/grouped-cache.test.ts`); auth fixtures, database isolation, and component tests above are planned additions.

| Gate | Command or method | Required evidence |
|---|---|---|
| Focused session proof | `bun run test -- src/lib/auth-utils.test.ts src/services/session.service.test.ts src/services/session.integration.test.ts` | U1 clocks, legacy adaptation, reissue, and logout races. |
| Focused email proof | `bun run test -- src/services/auth.service.test.ts src/services/auth.integration.test.ts src/services/auth.api.test.ts` | U2 issuance, admission, replay, delivery, binding, and cookie behavior. |
| Focused passkey proof | `bun run test -- src/services/passkey.service.test.ts src/services/passkey.integration.test.ts src/services/auth.api.test.ts` | U3 fixtures, persistence, signature checks, and challenge/counter races. |
| Focused recovery proof | `bun run test -- src/routes/login.test.tsx src/lib/post-auth-router.test.ts src/lib/pwa-auth.test.ts public/sw.test.ts` | U4 UI states, intent, and cache exclusions; use jsdom for component cases. |
| Full regression suite | `bun run test` | Existing grouped-cache behavior and all new tests pass. |
| Type check | `bunx tsc --noEmit` | Changed code is type-correct; distinguish pre-existing checkout failures with file-level evidence. |
| Production packaging | `bun run build` | Bun/Nitro bundle succeeds and browser output excludes server-only authentication code. |
| Bun runtime smoke | `bun run scripts/auth-passkey-smoke.ts` | Record Bun version and demonstrate genuine verification with the actual installed packages and database key round-trip, not only option generation or Vitest's host runtime. |
| Additive schema rollout | Existing `bun run db:migrate` against an explicitly disposable Postgres database only | New tables exist; existing users, memberships, links, and list data remain intact; repeated application is compatible. |
| Durable concurrency | Integration suites with two independent database connections sharing isolated test data | Limits, claims, revocation, and counters hold outside process memory. Tests must fail clearly when their database is absent rather than silently skip. |
| Installed-app acceptance | Physical iPhone and iPad on the configured HTTPS origin | Record device/OS versions and AE1–AE9 outcomes, including offline list regression and same-icon recovery. |

`src/test/auth-db.ts` must require an explicitly supplied disposable `AUTH_TEST_DATABASE_URL`, use isolated test data and at least two independently opened connections for race tests, and refuse to fall back to the application's `DATABASE_URL`.
SMTP delivery is mocked for deterministic service tests, followed by one real delivered-code check on the target installation.
Use real signed WebAuthn fixtures for server verification and targeted browser-operation mocks for component state tests.
No `release:validate`, lint, `db:generate`, or `db:check` script exists in the current manifest; none is assumed as a gate.

---

## Definition of Done

- U1 is complete when every session reader/writer uses the shared lifecycle, valid legacy sessions preserve their age, all three household reissue paths preserve deadlines, and revocation wins against concurrent renewal.
- U2 is complete when new email contains entered codes only, admission and durable issuance/attempt limits apply, consumption is single-use, existing identity/membership is restored, and old valid links still work once.
- U3 is complete when a persisted optional passkey authenticates its existing user without email, verification enforces all ceremony bindings, and actual package crypto works under Bun.
- U4 is complete when same-icon sign-in, fallback, optional enrollment, destination continuity, logout, and offline-list preservation are proven through automated checks and recorded iPhone/iPad acceptance.
- R1–R11 and AE1–AE9 have explicit passing evidence or a named unmet gate; an unavailable physical device is an acceptance gap, not a pass.
- All applicable Verification Contract gates pass, with any pre-existing failures distinguished from regressions. Production secrets, email codes, credential responses, and JWTs are absent from logs, fixtures containing live data, and review output.
- Additive rollout and stable-origin requirements are documented. Abandoned implementation attempts, dead link-issuance paths, and temporary debugging code are removed; unrelated pre-existing WIP is preserved.
