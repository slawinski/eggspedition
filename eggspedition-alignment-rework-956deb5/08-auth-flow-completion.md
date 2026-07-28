# RW-008 — Magic-link Authentication State Machine and Recovery

**Priority:** P1  
**Maps to:** UX-011, UX-001, UX-012, UX-014  
**Primary outcome:** authentication clearly communicates request progress, supports safe resend/change-email behavior, preserves return intent and guarantees single-use links.

## Verified implementation

The current revision provides:

- a magic-link login page;
- return-intent utilities;
- add/onboarding destination recovery;
- expired/invalid verification UI;
- server-side rate-limit scaffolding;
- email whitelisting/configuration;
- protected route middleware.

## Discrepancies

### Incomplete client state machine

The login screen primarily transitions from initial to sent. It lacks a robust pending state, resend timer, change-email action and visible retry path.

### Duplicate request risk

Without a durable pending state/disabled submission, repeated clicks can issue multiple link requests.

### Rate limiting is not deployment-safe

An in-memory limiter keyed by email resets on process restart and does not include IP/device abuse protection. Multiple app instances do not share it.

### Recovery uses hard navigation

Verification error recovery uses a plain anchor to `/login`, losing SPA state handling and potentially losing return intent.

### Single-use behavior is not a tested contract

Verification must atomically consume a token. The UI and server tests should distinguish expired, invalid and already-used links.

### Privacy and enumeration

Responses must remain neutral regardless of whether an account exists or is whitelisted, except where the whitelist is deliberately a private-app access rule.

## Product decision

Implement the full state machine:

```ts
type LoginState =
  | { phase: 'initial'; email: string }
  | { phase: 'requesting'; email: string }
  | { phase: 'sent'; email: string; resendAvailableAt: number }
  | { phase: 'request-failed'; email: string; error: LoginError }
```

### Initial

- email input;
- Continue button;
- return-intent context only when useful, e.g. “Log in to join this household.”

### Requesting

- button disabled;
- stable label `Sending link…`;
- input remains visible/read-only or disabled;
- prevent duplicate submit;
- announce pending once.

### Sent

- neutral confirmation;
- masked email, not necessarily full address;
- **Open email app** only where platform-safe;
- **Resend link** disabled until timer expires;
- **Use a different email** returns to initial without losing return intent.

### Failure

- preserve email;
- explain retryable vs access failure;
- **Try again**;
- no raw provider/server stack text.

## Return-intent contract

Use one validated relative destination object rather than independent optional fields:

```ts
interface AuthIntent {
  returnTo: string
  addDraft?: {
    name?: string
    quantity?: number
    categoryId?: string
    storeId?: string
  }
}
```

Serialize safely into URL parameters or a signed short-lived server state token.

Validation:

- same-origin relative paths only;
- allowed route prefixes;
- bounded length;
- reject protocol-relative and encoded external redirects;
- preserve invite route tokens only as required;
- consume/clear intent after successful navigation.

All compatibility routes such as `/quick-add` and `/add` must preserve intent when redirecting signed-out users.

## Magic-link server contract

### Request

```ts
requestMagicLink({
  email,
  intentToken?,
})
```

Always return a neutral accepted response where appropriate.

### Verify

```ts
verifyMagicLink({
  token,
})
```

Within one database transaction:

1. hash token;
2. select a non-expired, unused record;
3. mark it used/delete it atomically;
4. create session;
5. recover validated intent;
6. commit.

A second request with the same token returns `LINK_ALREADY_USED`.

Store only a hash of the raw token.

## Rate limiting

Use durable/shared storage in production.

Apply limits to:

- normalized email hash;
- IP/network identifier;
- global provider failure circuit as needed.

Return `Retry-After` and map it to a client countdown. Avoid logging raw email/token.

Example policy should be configurable rather than hardcoded:

- short burst limit;
- longer hourly limit;
- stricter provider-error behavior.

## Error taxonomy

```ts
type AuthErrorCode =
  | 'RATE_LIMITED'
  | 'EMAIL_NOT_ALLOWED'
  | 'DELIVERY_FAILED'
  | 'LINK_EXPIRED'
  | 'LINK_ALREADY_USED'
  | 'LINK_INVALID'
  | 'NETWORK'
  | 'UNKNOWN'
```

Verification page copy:

- expired: `This login link has expired. Request a new one.`
- used: `This login link was already used. Request a new one.`
- invalid: `This login link isn’t valid.`
- network: `We couldn’t verify the link. Try again.`

Use router `Link`/navigation while preserving intent.

## Security details

- no raw token in logs;
- set appropriate session cookie flags;
- rotate session on login;
- invalidate stale session after logout;
- do not expose account existence through timing/copy where avoidable;
- whitelist behavior should be documented as access control, not mistaken for authentication;
- email transport env names must match deployment configuration.

## File-level plan

### Modify

- `src/routes/login.tsx`
- magic-link verification route/component;
- `src/services/auth.api.ts`
- auth service/token schema;
- post-auth destination utilities;
- legacy redirect routes;
- deployment environment schema.

### Add

- `src/lib/auth-errors.ts`
- `src/lib/auth-intent.ts`
- durable rate-limit adapter;
- token-consumption transaction tests.

## Accessibility

- email field has visible label;
- errors are connected through `aria-describedby`;
- pending state does not shift focus unexpectedly;
- resend countdown is text, not only disabled-state styling;
- sent-state heading receives focus after transition;
- masked email still lets the user identify the destination;
- timers do not announce every second.

## Acceptance criteria

- Double-clicking Continue creates one request.
- Sent state provides resend and change-email actions.
- Resend respects server `Retry-After`.
- Return intent survives request, email click, onboarding and final navigation.
- External/open redirect values are rejected.
- A token can be used exactly once.
- Expired, used and invalid states have distinct safe UI.
- Verification recovery stays in SPA navigation and preserves intent.
- Production rate limits survive process restart/multiple instances.
- Logs contain no raw email or token.
- Compatibility routes preserve signed-out intent.

## Tests

- state-machine transitions;
- duplicate submit;
- resend timer with fake clock;
- neutral response/account enumeration;
- intent validation/open redirects;
- token expiry/single-use transaction race;
- shared rate limiting;
- provider failure;
- invite/add intent end-to-end;
- keyboard and focus transitions.
