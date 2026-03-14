import { createMiddleware } from '@tanstack/react-start'
import { getCookie } from 'vinxi/http'
import { verifySession } from '../lib/auth-utils'

export const authMiddleware = createMiddleware().handler(async ({ next }) => {
  const token = getCookie('session_token')
  const session = token ? await verifySession(token) : null

  return next({
    context: {
      session,
    },
  })
})

export const protectedMiddleware = createMiddleware().handler(async ({ next, context }) => {
  const token = getCookie('session_token')
  const session = token ? await verifySession(token) : null

  if (!session || !session.userId || !session.householdId) {
    throw new Error('Unauthorized or Household not set')
  }

  return next({
    context: {
      session: {
        ...session,
        householdId: session.householdId, // Ensure it's not undefined
      },
    },
  })
})
