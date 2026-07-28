# UX-011 — Magic-link Authentication and Return Intent

**Priority:** P1  
**Primary outcome:** users understand what happened after requesting a link and return to the exact task that initiated authentication.

## Problem

The login page requests an email and then displays a simple “link sent” state. It lacks a robust resend/change-email flow, explicit delivery guidance, throttling feedback and complete return-intent handling. Generic errors do not distinguish invalid email, rate limit, delivery failure or expired link. Add and household invite deep links can lose context when redirected to sign-in.

## Login page

### Initial state

Title: **Log in to Eggspedition**  
Body: “We’ll email you a secure sign-in link. No password needed.”

Fields/actions:

- Email address;
- primary CTA **Email me a sign-in link**;
- link back to the public landing page;
- concise privacy/delivery note.

Use `autocomplete="email"`, `inputmode="email"`, `spellcheck="false"` and a visible label.

### Pending state

- Disable only the submit action, not navigation.
- Button text: **Sending…**.
- Preserve the email field.
- Prevent duplicate requests while pending.

### Sent state

Title: **Check your email**  
Body: “We sent a sign-in link to **p…@example.com**.”

Actions:

- **Open email app** only when a reliable platform mechanism exists; otherwise omit rather than guessing a provider.
- **Send another link** after a visible countdown.
- **Use a different email**.

Guidance:

- link expiry time;
- check spam/junk;
- the link should be opened on this device when return intent is device-local, while still supporting cross-device login if session design permits.

Do not reveal the full email in public/shared-screen contexts unless the user just entered it; masking is a safer default.

## Return intent

Use one validated `returnTo` parameter containing only same-origin paths.

Examples:

- `/login?returnTo=%2F%3Fadd%3Ditem%26name%3DMilk`
- `/login?returnTo=%2Fjoin%2Fabcd1234`
- `/login?returnTo=%2Fsettings%2Fquick-add`

Requirements:

- reject absolute/external URLs to prevent open redirects;
- preserve add composer values and invite token;
- magic-link callback carries or recovers the return intent securely;
- after authentication, navigate with replace so Back does not return to a stale sent-link page;
- when return target is no longer valid, fall back to `/` with a clear message.

## Error states

Map server errors to product messages:

- invalid email: field-level correction;
- rate limited: “Try again in 42 seconds” with countdown based on server value;
- delivery provider failure: “We couldn’t send the email” with Retry;
- expired/used link: dedicated page with **Send a new link**;
- invalid token: do not imply that login succeeded;
- network/offline: “You’re offline. Connect to request a sign-in link.”

Never expose provider response bodies or internal errors.

## Security and privacy

- identical public response shape for registered and unregistered addresses when applicable;
- single-use, short-lived tokens;
- HttpOnly secure session cookie;
- rate limiting per address and IP with abuse-safe messaging;
- no email address in analytics;
- return intent signed or server-associated where tampering would be risky.

## Onboarding relationship

After first authentication:

- invite return target takes precedence and leads to invite preview;
- add-item return target opens the composer only after household setup is resolved;
- users without a household complete UX-001 before the add operation resumes;
- once setup completes, return to the preserved add intent.

Implement this as a small post-auth routing state machine, not scattered redirects.

## Accessibility

- error summary links to the email field;
- sent status receives programmatic focus or is announced once;
- resend countdown is not announced every second;
- buttons have stable labels and disabled explanations;
- token error page has a clear heading and recovery action.

## Acceptance criteria

- Request, pending, sent, resend, change-email and error states are implemented.
- Deep-link add and household-invite intent survives authentication.
- `returnTo` accepts same-origin application paths only.
- Expired/invalid links have dedicated recovery UI.
- Rate-limit feedback is specific and based on server response.
- Authentication completion never returns users to a stale login state.

## Tests

- same-origin return validation and malicious URL rejection;
- add/invite/settings return flows;
- first-login onboarding interposition;
- rate limit and resend timer;
- expired, used and invalid token;
- offline request;
- screen-reader announcement and focus transitions.

## Non-goals

- Password authentication.
- Social login providers.
- User account profile editing.
