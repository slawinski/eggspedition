import { createServerFn } from '@tanstack/react-start'
import { setCookie } from '@tanstack/react-start/server'
import { protectedMiddleware } from '../lib/middleware'
import { authOnlyMiddleware } from '../lib/middleware'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'

// ── Create a named household ──
export const createHouseholdFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.object({ name: z.string().min(1).max(100).optional() })))
  .middleware([authOnlyMiddleware])
  .handler(async ({ data, context }) => {
    const { createHousehold } = await import('./household.service')
    const { signSession } = await import('../lib/auth-utils')

    const household = await createHousehold(context.session.userId, data.name)

    // Update session cookie with new householdId
    const newToken = await signSession({
      userId: context.session.userId,
      email: context.session.email,
      householdId: household.id,
    })

    setCookie('session_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    return { householdId: household.id, name: household.name }
  })

// ── Create an invite ──
export const createHouseholdInviteFn = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        householdId: z.string().uuid(),
        expiresAt: z.string().optional(),
      }),
    ),
  )
  .middleware([protectedMiddleware])
  .handler(async ({ data, context }) => {
    const { createInvite } = await import('./household.service')

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : undefined
    const invite = await createInvite(data.householdId, context.session.userId, expiresAt)

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

    return {
      id: invite.id,
      token: invite.token,
      inviteUrl: `${baseUrl}/join/${invite.token}`,
      expiresAt: invite.expiresAt?.toISOString() || null,
    }
  })

// ── Preview an invite (no auth required) ──
export const previewHouseholdInviteFn = createServerFn({ method: 'GET' })
  .inputValidator(zodValidator(z.string()))
  .handler(async ({ data: token }) => {
    const { previewInvite } = await import('./household.service')
    return await previewInvite(token)
  })

// ── Accept an invite ──
export const acceptHouseholdInviteFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string()))
  .middleware([authOnlyMiddleware])
  .handler(async ({ data: token, context }) => {
    const { acceptInvite } = await import('./household.service')
    const { signSession } = await import('../lib/auth-utils')

    const householdId = await acceptInvite(token, context.session.userId)

    // Update session cookie with new householdId
    const newToken = await signSession({
      userId: context.session.userId,
      email: context.session.email,
      householdId,
    })

    setCookie('session_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    return { householdId }
  })

// ── Revoke an invite ──
export const revokeHouseholdInviteFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string()))
  .middleware([protectedMiddleware])
  .handler(async ({ data: inviteId, context }) => {
    const { revokeInvite } = await import('./household.service')
    await revokeInvite(inviteId, context.session.userId)
    return { success: true }
  })

// ── Get household members ──
export const getHouseholdMembersFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { getHouseholdMembers } = await import('./household.service')
    return await getHouseholdMembers(context.session.householdId)
  })

// ── Get pending invites ──
export const getPendingInvitesFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { getPendingInvites } = await import('./household.service')
    return await getPendingInvites(context.session.householdId)
  })

// ── Get household member count ──
export const getHouseholdMemberCountFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { getHouseholdMemberCount } = await import('./household.service')
    return await getHouseholdMemberCount(context.session.householdId)
  })

// ── Update household name ──
export const updateHouseholdNameFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string().min(1).max(100)))
  .middleware([protectedMiddleware])
  .handler(async ({ data: name, context }) => {
    const { updateHouseholdName } = await import('./household.service')
    return await updateHouseholdName(context.session.householdId, name)
  })
