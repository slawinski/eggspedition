# RW-007 — Household Onboarding and Settings Hardening

**Priority:** P1  
**Maps to:** UX-001, UX-008, UX-012  
**Primary outcome:** first-time users can create or join a household with complete error recovery, and household settings display authoritative data rather than empty placeholders.

## Verified implementation

The current revision implements the core flow:

- authenticated users without a household are redirected to onboarding;
- users choose Start or Join;
- invite tokens can be accepted without a full page reload;
- add-item deep-link intent is carried through onboarding;
- household settings expose members, invites and a name form;
- invite creation/revocation server operations exist.

## Discrepancies

### Create errors are stored in the wrong presentation state

`handleCreate` writes failures to `joinError`, but the choose/create UI does not render that error. A failed creation can leave the user on the same screen with no explanation.

### “Start household” is both choice and destructive submission

Selecting the card immediately creates the household. The specification expected a lightweight second step where the user may name it and deliberately confirm creation.

### Progress indicator is misleading

The view displays step 1 of 2, but the create path has no visible step 2 and the join path uses local conditional content rather than a consistent step model.

### Current household name is not loaded

Household Settings initializes `newName` to empty and contains a comment explicitly leaving it empty because the household record is not queried.

### Settings mutation errors are absent

Create invite, revoke invite and name update define success handling but no visible error state or Retry action.

### Member identity and roles need product decisions

Settings displays full member emails. This may be acceptable for a household admin surface, but the role/permission model and privacy copy should be explicit.

## Product decision

Use a compact two-step onboarding state machine.

```ts
type HouseholdOnboardingStep =
  | 'choose'
  | 'create'
  | 'join'
```

### Choose

- **Start a household**
- **Join a household**

No server mutation occurs on choice.

### Create

Fields:

- household name, optional;
- default derived label when omitted, for example “My household”.

Actions:

- **Create household**
- **Back**

### Join

- pasted invite link or token;
- preview of household and inviter where available;
- **Join household**
- **Back**

The progress component reflects the actual state:

- choose: step 1 of 2;
- create/join: step 2 of 2.

## Onboarding state and errors

Use separate errors:

```ts
interface OnboardingState {
  step: 'choose' | 'create' | 'join'
  createError?: AppError
  joinError?: AppError
}
```

Rules:

- clear only the error for the action being retried;
- render failure adjacent to the relevant primary action;
- focus the error summary after a failed submission;
- preserve the typed household name/invite;
- avoid exposing raw server messages for unexpected errors.

Copy examples:

- `We couldn’t create the household. Try again.`
- `This invite has expired. Ask the sender for a new link.`
- `You already belong to this household.`

## Authoritative household query

Add:

```ts
getCurrentHouseholdFn(): {
  id: string
  name: string
  role: 'admin' | 'member'
  memberCount: number
}
```

Household Settings should query this record and initialize the form from it. Do not derive the household name from members or session fields unless the session intentionally contains authoritative household data.

Use separate draft and server value:

```ts
const [draftName, setDraftName] = useState(household.name)
const dirty = draftName !== household.name
```

When background data changes:

- update draft only if not dirty;
- otherwise show a non-blocking conflict notice.

## Invite management

### Create

- show pending state;
- on success expose native Share API where supported;
- fallback Copy Link;
- provide expiration date;
- optionally provide QR only if tested and useful;
- never display an invite as successfully created if the mutation failed.

### Revoke

- disable only the selected invite;
- optimistically mark/revoke with rollback;
- error provides Retry;
- use invite ID and current household scope on the server.

### Join preview

Invite route should return a safe preview before authentication:

- household display name;
- inviter display name or generic “A household member”;
- expiration/validity;
- never household/member IDs.

## Session/router refresh

After create/join:

1. invalidate/reload the authenticated route context or session;
2. invalidate household queries;
3. navigate to preserved return intent;
4. use `replace` so onboarding is not a stale Back destination.

Do not depend only on TanStack Query invalidation if household membership lives in router context/cookies.

## Permissions

Define explicit capabilities:

```ts
interface HouseholdPermissions {
  canRename: boolean
  canInvite: boolean
  canRevokeInvite: boolean
  canManageMembers: boolean
}
```

Hide or disable controls based on server-derived role. Server enforcement remains mandatory.

## File-level plan

### Modify

- `src/routes/onboarding/household.tsx`
- onboarding components and CSS;
- `src/routes/settings/household.tsx`
- `src/services/household.api.ts`
- `src/services/household.service.ts`
- session/router invalidation utilities.

### Add

- `src/components/onboarding/CreateHouseholdForm.tsx`
- `src/hooks/useCurrentHousehold.ts`
- shared invite error mapping.

## Accessibility

- one route-level `h1`;
- step changes announce through a polite live region;
- pending buttons use `aria-busy`;
- errors use alert semantics without repeated announcements;
- Back is a button and restores focus to the chosen card;
- invite preview has a descriptive heading;
- member list is a semantic list/table appropriate to its content;
- Copy success is announced.

## Acceptance criteria

- Choosing Start does not create until confirmation.
- Optional household name is saved and later shown in Settings.
- Create failures are visible and retryable without losing the name.
- Join failures remain scoped to Join and preserve the invite.
- Progress indicator matches actual step.
- Successful create/join refreshes route session before destination render.
- Preserved Add intent still opens Add after onboarding.
- Household Settings loads the current name.
- Invite create/revoke/name-update failures are visible and retryable.
- Permissions are enforced client- and server-side.
- Invite preview does not expose internal IDs.
- No full page reload is required.

## Tests

- create success/failure/retry;
- join valid/expired/already-member/failure;
- route context refresh;
- preserved Add intent;
- dirty name with background update;
- invite create/revoke rollback;
- role-based controls;
- keyboard/focus step transitions;
- screen-reader announcements.
