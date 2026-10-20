import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'
import { requestEmailCodeSchema } from '../lib/auth-inputs'
import { verifyEmailCodeSchema, finishPasskeyRegistrationSchema, finishPasskeyAuthenticationSchema } from '../lib/schemas'

export const getSessionServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { readSessionCookie } = await import('../lib/session-cookies')
  const session = await readSessionCookie()

  // Attach display context without putting it in the signed transport.
  if (session?.householdId) {
    const { getHouseholdName } = await import('./household.service')
    const householdName = await getHouseholdName(session.householdId)
    return { ...session, householdName }
  }

  return session
})

export const loginServerFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(requestEmailCodeSchema))
  .handler(async ({ data }) => {
    const { requireAuthOrigin, beginAuthBinding } = await import('../lib/auth-origin')
    requireAuthOrigin()
    const { requestEmailCode } = await import('./auth.service')
    return requestEmailCode(data.email, beginAuthBinding())
  })

export const verifyEmailCodeServerFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(verifyEmailCodeSchema))
  .handler(async ({ data }) => {
    const { requireAuthOrigin, readAuthBinding } = await import('../lib/auth-origin')
    requireAuthOrigin()
    const { verifyEmailCode } = await import('./auth.service')
    const { writeSessionCookie } = await import('../lib/session-cookies')
    const result = await verifyEmailCode(data, readAuthBinding())
    if (result.status !== 'authenticated') return result
    writeSessionCookie(result.transport)
    // Neither the signed transport nor the internal session result crosses RPC.
    return { status: 'authenticated' as const, hasHousehold: result.hasHousehold }
  })

export const logoutServerFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    const { requireAuthOrigin } = await import('../lib/auth-origin')
    requireAuthOrigin()
    const { revokeSession } = await import('./session.service')
    const { clearSessionCookie, privateSessionResponse } = await import('../lib/session-cookies')
    privateSessionResponse()
    const token = getCookie('session_token')
    if (token) await revokeSession(token)
    clearSessionCookie()
    return { success: true }
  })

export const verifyMagicLinkServerFn = createServerFn({ method: 'GET' })
  .inputValidator(zodValidator(z.string()))
  .handler(async ({ data: token }) => {
    const { verifyMagicLink } = await import('./auth.service')
    const { writeSessionCookie, privateSessionResponse } = await import('../lib/session-cookies')
    privateSessionResponse()
    const result = await verifyMagicLink(token)
    
    if (result) {
      writeSessionCookie(result.transport)
      return { success: true as const, hasHousehold: result.hasHousehold }
    }
    
    return { success: false as const, hasHousehold: false }
  })

export const beginPasskeyRegistrationServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { requireAuthOrigin, authOrigin, beginAuthBinding } = await import('../lib/auth-origin')
  requireAuthOrigin()
  const { readSessionCookie } = await import('../lib/session-cookies')
  const session = await readSessionCookie()
  if (!session) return { status: 'unauthenticated' as const }
  const { beginPasskeyRegistration } = await import('./passkey.service')
  return beginPasskeyRegistration(session, beginAuthBinding(), authOrigin())
})

export const finishPasskeyRegistrationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(finishPasskeyRegistrationSchema))
  .handler(async ({ data }) => {
    const { requireAuthOrigin, authOrigin, readAuthBinding } = await import('../lib/auth-origin')
    requireAuthOrigin()
    const { readSessionCookie } = await import('../lib/session-cookies')
    const { finishPasskeyRegistration } = await import('./passkey.service')
    return finishPasskeyRegistration(data, readAuthBinding(), authOrigin(), await readSessionCookie('session', false))
  })

export const beginPasskeyAuthenticationServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { requireAuthOrigin, authOrigin, beginAuthBinding } = await import('../lib/auth-origin')
  requireAuthOrigin()
  const { beginPasskeyAuthentication } = await import('./passkey.service')
  return beginPasskeyAuthentication(beginAuthBinding(), authOrigin())
})

export const finishPasskeyAuthenticationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(finishPasskeyAuthenticationSchema))
  .handler(async ({ data }) => {
    const { requireAuthOrigin, authOrigin, readAuthBinding } = await import('../lib/auth-origin')
    requireAuthOrigin()
    const { finishPasskeyAuthentication } = await import('./passkey.service')
    const result = await finishPasskeyAuthentication(data, readAuthBinding(), authOrigin())
    if (result.status !== 'authenticated') return result
    const { writeSessionCookie } = await import('../lib/session-cookies')
    writeSessionCookie(result.transport)
    return { status: 'authenticated' as const, hasHousehold: result.hasHousehold }
  })
