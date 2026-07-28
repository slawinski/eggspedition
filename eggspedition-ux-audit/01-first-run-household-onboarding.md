# UX-001 — First-run Household Onboarding and Sharing

**Priority:** P0  
**Primary outcome:** a new user understands whether they are creating or joining a household and reaches a usable shared list without discovering account-menu controls by accident.

## Problem

Household collaboration is the core differentiator, but its setup is presented as utility controls. The Home page renders `ShareHousehold`, while the header dropdown repeats “Share ID” and “Join Household.” Joining requires pasting a raw identifier and triggers a hard reload. Errors are not surfaced near the action.

This creates several product problems:

- “Household” is not explained before the user must act on it.
- Creating versus joining is implicit.
- A raw ID is difficult to communicate, recognize and trust.
- The same actions exist in more than one location.
- A successful join breaks SPA continuity with `window.location.reload()`.
- A failed join can look like an unresponsive button.

## Target experience

After the first successful sign-in, show one dedicated setup screen when the user has no confirmed household context.

### Step 1 — Choose the path

Title: **How will you use Eggspedition?**

Two large options:

1. **Start a household** — “Create a new shared list and invite other people.”
2. **Join a household** — “Use an invite from someone you shop with.”

Do not call one choice “default.” Users should make an explicit decision.

### Step 2A — Start a household

- Ask for an optional household name, such as “Home” or “Szczęśliwicka flat.”
- Default to “My household” only after the field is left empty.
- Create the household, then show the list immediately.
- Display an unobtrusive onboarding card above the empty list: **Invite someone to shop together**.
- Provide OS share, copy invite link and QR code options.

### Step 2B — Join a household

- Accept a full invite URL or short code in one field.
- Normalize spaces and casing automatically.
- Show the target household name and inviter, when available, before confirmation.
- Confirmation CTA: **Join [household name]**.
- On success, invalidate session/household queries and navigate without a hard reload.
- On invalid, expired or already-used invite, show a specific recovery message.

### Returning users

Move collaboration management to a dedicated **Household** settings screen. The account menu should link to it rather than embedding the join form.

## Sharing model

Replace raw household-ID sharing with invite records.

Recommended invite format:

`https://<host>/join/<short-token>`

Properties:

- short, random, revocable token;
- household-scoped;
- optional expiration;
- records creator and redemption;
- never expose a database household primary key as the product-facing credential.

The share sheet should use `navigator.share()` when available and fall back to Copy link. Suggested copy:

> Join my Eggspedition household and add items to our shared grocery list.

## Information architecture

Create:

- route: `/onboarding/household`
- route: `/settings/household`
- optional route: `/join/$token`

Remove or de-emphasize:

- inline join UI inside `Header.tsx`;
- duplicate join/share controls on Home after onboarding is complete;
- raw ID chip as the primary sharing mechanism.

## Engineering plan

### New domain/API operations

- `createHousehold({ name? })`
- `createHouseholdInvite({ householdId, expiresAt? })`
- `previewHouseholdInvite({ token })`
- `acceptHouseholdInvite({ token })`
- `revokeHouseholdInvite({ inviteId })`

### Client state

- Route loaders should resolve the session and setup state before rendering the authenticated shell.
- Do not render the normal List screen briefly before redirecting to onboarding.
- After create/join, update the session cache directly and invalidate household-scoped queries.
- Remove `window.location.reload()` from both `ShareHousehold.tsx` and `Header.tsx`.

### Components

Create reusable components:

- `HouseholdChoiceCard`
- `InviteInput`
- `InvitePreview`
- `HouseholdShareActions`
- `OnboardingProgress`

The share actions can be reused in onboarding, settings and a contextual empty-state card.

## Accessibility

- Each choice card must be a real button or radio option, not a clickable `div`.
- Focus the main heading when the onboarding route loads.
- Announce invite preview, success and errors through a polite live region.
- QR code must have a text link adjacent to it; never make QR the only path.
- Ensure the back action does not discard a successfully created household.

## Edge cases

- User opens an invite while signed out: retain the token through magic-link authentication.
- User already belongs to a household: explain that joining switches active household if multiple households are not supported.
- User pastes their current household invite: show “You already belong to this household.”
- Invite expires during preview: confirmation should return a specific expired state.
- Offline: allow copying an existing cached invite, but do not claim that a new invite was created.

## Acceptance criteria

- A first-time authenticated user sees an explicit Start/Join choice.
- The user can complete either path using only the keyboard.
- Invite links survive authentication and return the user to the join confirmation.
- No normal create/join path performs a hard reload.
- Invalid join attempts display actionable errors.
- The header contains one link to Household settings, not a duplicate embedded form.
- The product never requires a user to read or copy a raw database household ID.

## Tests

- route test: unauthenticated `/join/:token` → login → same invite preview;
- integration test: create household → session cache updated → list shown;
- integration test: invalid, expired and already-member invite states;
- accessibility test: choice cards, live messages and focus order;
- mobile test: native share available and unavailable;
- regression test: query keys use the newly active household after joining.

## Non-goals

- Multiple simultaneously active households.
- Household roles and granular permissions.
- Contact-book invitations.
