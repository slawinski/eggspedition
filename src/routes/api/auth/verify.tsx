import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { verifyMagicLinkServerFn } from '../../../services/auth.api'
import { resolvePostAuthDestination } from '../../../lib/post-auth-router'
import { useEffect, useRef } from 'react'
import auth from '../../../styles/auth.module.css'

export const Route = createFileRoute('/api/auth/verify')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string,
    returnTo: search.returnTo as string | undefined,
    name: search.name as string | undefined,
    quantity: search.quantity as string | undefined,
    category: search.category as string | undefined,
    store: search.store as string | undefined,
    invite: search.invite as string | undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps: search }) => {
    const result = await verifyMagicLinkServerFn({ data: search.token })
    
    if (result.success) {
      const destination = resolvePostAuthDestination({
        returnTo: search.returnTo,
        invite: search.invite,
        name: search.name,
        quantity: search.quantity,
        category: search.category,
        store: search.store,
        hasHousehold: result.hasHousehold,
      })
      throw redirect({
        to: destination.to as any,
        search: destination.search as any,
        replace: true,
      })
    }
    
    return { error: 'This sign-in link is invalid or has expired.' }
  },
  component: VerifyComponent,
})

function VerifyComponent() {
  const { error } = Route.useLoaderData()
  const { token: _token, ...intent } = Route.useSearch()
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => { heading.current?.focus() }, [])

  return (
    <main id="main-content" className={auth.page} tabIndex={-1}>
      <div className={auth.column}>
        <h1 ref={heading} tabIndex={-1} className={auth.title}>This sign-in link is unavailable</h1>
        <p role="alert" className={auth.error}>{error}</p>
        <p className={auth.intro}>
          Sign in with an email code instead. Return here to enter the code without reinstalling the app.
        </p>
        <Link to="/login" search={intent} className={auth.primary}>Request an email code</Link>
      </div>
    </main>
  )
}
