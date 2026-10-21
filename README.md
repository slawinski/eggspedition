Welcome to your new TanStack Start app! 

# Getting Started

To run this application:

```bash
bun install
bun --bun run dev
```

## Sign-in deployment and recovery

- Use Bun and configure the required values from `.env.schema`, including Postgres, SMTP, admission restrictions, `AUTH_SECRET`, and `BASE_URL`. Keep `AUTH_SECRET` stable and private.
- `BASE_URL` must be the stable HTTPS origin used by the installed app (for example `https://groceries.example.com`). The passkey RP ID is its hostname; changing that hostname makes existing passkeys unusable there. HTTP localhost is the development exception, not physical-device acceptance. Do not broaden allowed origins to work around a mismatch.
- Before rollout, back up the database and run the existing `bun run db:migrate` schema-push path with the configured environment. This release adds email-code, challenge, passkey, and session tables; retain existing users, households, list data, legacy links, and sessions. First apply and repeat the additive push against an explicitly disposable database and verify preservation. There is no versioned migration runner in this project.
- New sign-in emails contain a six-digit code, not an authentication link. Enter the code in the same browser or Home Screen app that requested it. Codes expire after 10 minutes, allow five incorrect attempts, and can be resent after 60 seconds. Resending replaces the previous code. Issuance is limited to three per 15 minutes and ten per 24 hours per normalized email; delivery failures still count toward these limits.
- Passkey sign-in is an explicit alternative to email. After code verification, passkey setup is optional. Options load first; the next device-passkey button opens the authenticator directly from a fresh gesture, including on Safari. Skipping, cancelling, or failing setup does not undo sign-in. No prompt or enrollment runs automatically.
- Remembered sessions renew on successful server-observed authenticated activity, bounded by 30 days of inactivity or 90 days from fresh sign-in, whichever comes first. Offline cached activity does not renew a session. Explicit signout revokes the current session, clears persisted user queries, and awaits the service worker's HTML-cache acknowledgement. If an older worker cannot acknowledge, the app retires that worker, removes its application caches, and reloads sign-in. Normal acknowledged logout retains static assets; offline list persistence is unchanged until confirmed logout.
- A signed-out Home Screen launch routes to sign-in after client-side standalone detection. A normal browser retains the landing page and a visible sign-in action. Authentication needs a connection: auth pages and `/_serverFn/` GET responses are network-only and never fall back to cached authenticated HTML. The worker cache-version change removes the older cached root.
- Previously emailed, unexpired sign-in links remain consumable once during the compatibility window; expired links lead to email-code recovery with supported routing intent retained.

### Focused recovery checks

```bash
bun run test -- src/routes/-login.test.tsx src/routes/onboarding/-household.test.tsx src/lib/post-auth-router.test.ts src/lib/pwa-auth.test.ts public/sw.test.ts
```

Component tests mock the existing auth server-function boundary and `@simplewebauthn/browser` operations, not account/session policy. Worker tests execute `public/sw.js` in a VM and exercise cache races and message acknowledgements. No production authentication bypass is provided. For local UI scenarios, reuse the mocks in `src/routes/-login.test.tsx` for sent/error/expired results, delayed options, cancelled ceremonies, household/no-household, and invitation/item intent. For a real browser run, use the normal dev command and real admitted test identities and email delivery; WebAuthn browser tooling or mocks can exercise prompts but cannot establish installed-iOS acceptance. Service workers are intentionally unregistered on localhost; test the worker on the configured HTTPS origin.

### Physical-device acceptance — pending, not passed

Real SMTP delivery and physical iPhone/iPad Home Screen QA have **not** been verified by these automated tests. Record the device model, exact iOS/iPadOS version, stable install origin, test date, and outcomes before marking acceptance complete:

| Surface | Device / OS / origin / date | Required checks | Result |
| --- | --- | --- | --- |
| iPhone installed from Safari | Pending | Delivered code → mail → same icon; optional setup/skip/cancel; returning passkey and email fallback; invalid/expired code; admission denial; invite/item destination; session boundaries; logout and offline/online reopen; existing offline list | Pending |
| iPad installed from Safari | Pending | Same checks, including a real device authenticator and interrupted intent without reinstalling | Pending |

Desktop emulation and mocked WebAuthn are not evidence that the original device-level reinstall problem is resolved. Full regression, packaging, DB/runtime verification, and real-device acceptance are separate release gates.

# Building For Production

To build this application for production:

```bash
bun --bun run build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. Auth integration tests require an explicitly supplied disposable Postgres database and create isolated schemas; they never fall back to the application's `DATABASE_URL`. With a disposable local database running, run:

```bash
AUTH_TEST_DATABASE_URL=postgres://localhost:5432/eggspedition_auth_test bun --bun run test
```

The Bun passkey smoke check verifies real signatures and a database key round-trip:

```bash
AUTH_TEST_DATABASE_URL=postgres://localhost:5432/eggspedition_auth_test bun run scripts/auth-passkey-smoke.ts
```

After a production build, also exercise the emitted server code rather than only the installed source package:

```bash
bun run build
AUTH_TEST_DATABASE_URL=postgres://localhost:5432/eggspedition_auth_test bun run scripts/auth-passkey-smoke.ts --production
```

Nitro preserves the `reflect-metadata` side effects required by the passkey library's decorator-based dependencies. The production smoke check catches initialization failures that source-package tests cannot detect.

## Styling

This project uses **CSS Modules** for styling, with a custom "Claymorphism" design system.

- `src/styles.css`: Global styles and CSS Reset.
- `src/styles/clay.module.css`: Design system components (cards, buttons, inputs).
- `*.module.css`: Component-specific styles for layout and functionality.

We strictly avoid utility-first frameworks like Tailwind to maintain a highly custom, performant, and maintainable aesthetic.



## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
