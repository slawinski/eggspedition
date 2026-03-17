import { createMiddleware } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { verifySession } from '../lib/auth-utils'

export const authMiddleware = createMiddleware({ type: 'request' }).server(async ({ next }) => {
  const token = getCookie('session_token')
  const session = token ? await verifySession(token) : null

  return next({
    context: {
      session,
    },
  })
})

export const protectedMiddleware = createMiddleware().server(async ({ next }) => {
  const token = getCookie('session_token')
  const session = token ? await verifySession(token) : null

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
