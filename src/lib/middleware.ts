import { createMiddleware } from '@tanstack/react-start'
import { readSessionCookie } from './session-cookies'

export const authMiddleware = createMiddleware({ type: 'request' }).server(async ({ next }) => {
  // Request context alone is not admitted activity (it may be static or later denied).
  const session = await readSessionCookie('session', false)

  return next({
    context: {
      session,
    },
  })
})

/** Requires only authentication (userId), not household membership. */
export const authOnlyMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await readSessionCookie('auth-only')

  if (!session || !session.userId) {
    throw new Error('Unauthorized')
  }

  return next({
    context: {
      session,
    },
  })
})

/** Requires authentication AND household membership. */
export const protectedMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await readSessionCookie('household')

  if (!session || !session.userId || !session.householdId) {
    throw new Error('Unauthorized or Household not set')
  }

  return next({
    context: {
      session: {
        ...session,
        householdId: session.householdId,
      },
    },
  })
})
