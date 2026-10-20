import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { SignJWT } from 'jose'
import { requestHandler } from '@tanstack/start-server-core'
import { runWithStartContext } from '@tanstack/start-storage-context'
import { authSessions, groceryItems, households, magicLinks, memberships, users } from '../db/schema'
import { createAuthTestDatabase, type AuthTestDatabase } from '../test/auth-db'
import { createSession, resolveSession, revokeSession } from './session.service'
import { verifySession } from '../lib/auth-utils'

let testDb: AuthTestDatabase
// Substitute only DB wiring, never persistence or security outcomes. No application URL is read.
vi.mock('../db', () => ({ get db() { return testDb.db }, get queryClient() { return testDb.first } }))

const start = new Date('2026-10-20T12:00:00Z')
const day = 86400
const at = (days: number) => new Date(start.getTime() + days * day * 1000)
let identity: { userId: string; email: string }
let originalHousehold: string
let preserved: { users: unknown; memberships: unknown; links: unknown; items: unknown }

beforeAll(async () => {
  vi.stubEnv('BASE_URL', 'https://eggspedition.example.test')
  testDb = await createAuthTestDatabase()
  const [user] = await testDb.db.insert(users).values({ email: 'existing@example.test' }).returning()
  identity = { userId: user.id, email: user.email }
  const [household] = await testDb.db.insert(households).values({ name: 'Existing household' }).returning()
  originalHousehold = household.id
  await testDb.db.insert(memberships).values({ userId: user.id, householdId: household.id })
  await testDb.db.insert(magicLinks).values({ email: user.email, token: 'pre-release-link', expiresAt: at(1) })
  await testDb.db.insert(groceryItems).values({ name: 'Preserved eggs', householdId: household.id, userId: user.id })
  preserved = {
    users: await testDb.db.select().from(users), memberships: await testDb.db.select().from(memberships),
    links: await testDb.db.select().from(magicLinks), items: await testDb.db.select().from(groceryItems),
  }
  await testDb.addSessions()
}, 20000)
afterEach(() => vi.useRealTimers())
afterAll(async () => { await testDb?.close(); vi.unstubAllEnvs() })

/** Run compiled server functions/middleware with real Start request storage, without a network server. */
async function request(invoke: () => Promise<unknown>, token?: string) {
  const handler = requestHandler(async (incoming) => {
    return runWithStartContext({
      request: incoming, startOptions: {}, contextAfterGlobalMiddlewares: {},
      executedRequestMiddlewares: new Set(),
      getRouter: () => { throw new Error('Session adapters must not need a router') },
    }, async () => {
      try {
        const value = await invoke()
        return value instanceof Response ? value : Response.json(value)
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
      }
    })
  })
  return handler(new Request('https://eggspedition.example.test/test', {
    headers: { origin: 'https://eggspedition.example.test', ...(token ? { cookie: `session_token=${token}` } : {}) },
  }), {})
}

function cookieToken(response: Response) {
  const cookie = response.headers.get('set-cookie')
  expect(cookie).toBeTruthy()
  return decodeURIComponent(cookie!.split(';')[0].slice('session_token='.length))
}

describe('U1 adapter and durable integration', () => {
  it('adds the session table without changing existing identities, memberships, links or list data', async () => {
    expect(await testDb.db.select().from(users)).toEqual(preserved.users)
    expect(await testDb.db.select().from(memberships)).toEqual(preserved.memberships)
    expect(await testDb.db.select().from(magicLinks)).toEqual(preserved.links)
    expect(await testDb.db.select().from(groceryItems)).toEqual(preserved.items)
  })

  it('keeps the legacy endpoint callable, restores existing identity and atomically consumes once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(start)
    const { verifyMagicLinkServerFn } = await import('./auth.api')
    const response = await request(() => verifyMagicLinkServerFn({ data: 'pre-release-link' }))
    expect(await response.json()).toEqual({ success: true, hasHousehold: true })
    const claims = await verifySession(cookieToken(response), start)
    expect(claims).toMatchObject({ ...identity, householdId: originalHousehold })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('set-cookie')).toContain('Max-Age=2592000')
    const replay = await request(() => verifyMagicLinkServerFn({ data: 'pre-release-link' }))
    expect(await replay.json()).toEqual({ success: false, hasHousehold: false })
    expect(replay.headers.get('set-cookie')).toBeNull()

    const { verifyMagicLink } = await import('./auth.service')
    await testDb.db.insert(magicLinks).values({ email: identity.email, token: 'racing-link', expiresAt: at(1) })
    const results = await Promise.all([
      verifyMagicLink('racing-link', testDb.db, start), verifyMagicLink('racing-link', testDb.otherDb, start),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(results.find(Boolean)?.session.userId).toBe(identity.userId)
    await testDb.db.insert(magicLinks).values({ email: identity.email, token: 'expired-link', expiresAt: start })
    expect(await verifyMagicLink('expired-link', testDb.db, start)).toBeNull()
  })

  it('session reads renew the cookie but serialize only Session, with the household display name', async () => {
    const fresh = await createSession({ ...identity, householdId: originalHousehold }, testDb.db, start)
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at(29))
    const { getSessionServerFn } = await import('./auth.api')
    const response = await request(() => getSessionServerFn(), fresh.transport.token)
    const body = await response.json()
    expect(body).toEqual({ ...fresh.session, householdName: 'Existing household' })
    expect(body).not.toHaveProperty('transport')
    expect(body).not.toHaveProperty('token')
    const claims = await verifySession(cookieToken(response), at(29))
    expect(claims?.exp).toBe(at(59).getTime() / 1000)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=2592000')
    const [row] = await testDb.otherDb.select().from(authSessions).where(eq(authSessions.id, fresh.session.sessionId))
    expect(row.inactivityExpiresAt.getTime() / 1000).toBe(claims?.exp)
  })

  it.each(['create', 'invite', 'grocery'] as const)('%s household path preserves session ID, authentication time, capped expiry and cookie options', async (path) => {
    let current = await createSession({ ...identity, householdId: originalHousehold }, testDb.db, start)
    for (const days of [29, 58, 87]) current = (await resolveSession(current.transport.token, {}, testDb.db, at(days)))!
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at(88))
    const { createHouseholdFn, acceptHouseholdInviteFn } = await import('./household.api')
    const { createInvite } = await import('./household.service')
    const { joinHouseholdFn } = await import('./grocery.api')
    const [target] = await testDb.db.insert(households).values({ name: `Target ${path}` }).returning()
    const invite = path === 'invite' ? await createInvite(originalHousehold, identity.userId) : null
    const response = await request(() => path === 'create'
      ? createHouseholdFn({ data: { name: 'New household' } })
      : path === 'invite'
        ? acceptHouseholdInviteFn({ data: invite!.token })
        : joinHouseholdFn({ data: target.id }), current.transport.token)
    const body = await response.json()
    const householdId = typeof body === 'string' ? body : body.householdId
    const claims = await verifySession(cookieToken(response), at(88))
    expect(claims).toMatchObject({ ...current.session, householdId, exp: at(90).getTime() / 1000 })
    const cookie = response.headers.get('set-cookie')!
    expect(cookie).toContain('Max-Age=172800')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const [row] = await testDb.otherDb.select().from(authSessions).where(eq(authSessions.id, current.session.sessionId))
    expect(row.authenticatedAt).toEqual(start)
    expect(row.absoluteExpiresAt).toEqual(at(90))
  })

  it('failed household authorization does not renew access', async () => {
    const fresh = await createSession(identity, testDb.db, start)
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at(10))
    const { getGroceryItemsFn } = await import('./grocery.api')
    const denied = await request(() => getGroceryItemsFn(), fresh.transport.token)
    expect(denied.ok).toBe(false)
    expect(await denied.json()).toEqual({ error: 'Unauthorized or Household not set' })
    expect(denied.headers.get('set-cookie')).toBeNull()
    const [row] = await testDb.otherDb.select().from(authSessions).where(eq(authSessions.id, fresh.session.sessionId))
    expect(row.lastActivityAt).toEqual(start)
    expect(row.inactivityExpiresAt).toEqual(at(30))
  })

  it('SSE authorizes once before streaming, and keep-alive frames never touch activity or cookies', async () => {
    const fresh = await createSession({ ...identity, householdId: originalHousehold }, testDb.db, start)
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }).setSystemTime(at(10))
    const { householdSignalFn } = await import('./grocery.api')
    const response = await request(() => householdSignalFn(), fresh.transport.token)
    const reader = response.body!.getReader()
    const cookies = response.headers.get('set-cookie')
    vi.setSystemTime(at(20))
    await vi.advanceTimersByTimeAsync(30000)
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(': keep-alive')
    const [row] = await testDb.otherDb.select().from(authSessions).where(eq(authSessions.id, fresh.session.sessionId))
    expect(row.lastActivityAt).toEqual(at(10))
    expect(row.inactivityExpiresAt).toEqual(at(40))
    expect(response.headers.get('set-cookie')).toBe(cookies)
    await reader.cancel()
    const { signalEmitter } = await import('../lib/signals')
    signalEmitter.removeAllListeners('household-signal')
  })

  it('logout revokes before clearing the cookie and stale in-flight renewal cannot restore access', async () => {
    const fresh = await createSession(identity, testDb.db, start)
    vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(at(5))
    const { logoutServerFn, getSessionServerFn } = await import('./auth.api')
    const [response, lateRenewal] = await Promise.all([
      request(() => logoutServerFn(), fresh.transport.token),
      resolveSession(fresh.transport.token, {}, testDb.otherDb, at(5)),
    ])
    expect(await response.json()).toEqual({ success: true })
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    const [row] = await testDb.otherDb.select().from(authSessions).where(eq(authSessions.id, fresh.session.sessionId))
    expect(row.revokedAt).toEqual(at(5))
    for (const token of [fresh.transport.token, lateRenewal?.transport.token].filter((token): token is string => !!token)) {
      const stale = await request(() => getSessionServerFn(), token)
      expect(await stale.json()).toBeNull()
      expect(stale.headers.get('set-cookie')).toBeNull()
    }
    const next = await createSession(identity, testDb.db, at(5))
    expect(next.session.sessionId).not.toBe(fresh.session.sessionId)
    expect(await resolveSession(next.transport.token, {}, testDb.otherDb, at(5))).not.toBeNull()
  })

  it('concurrent legacy logout/adoption retains one revoked digest across connections', async () => {
    const token = await new SignJWT({ ...identity, iat: at(-10).getTime() / 1000, exp: at(20).getTime() / 1000 })
      .setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(process.env.AUTH_SECRET!))
    const [, adopted] = await Promise.all([
      revokeSession(token, testDb.db, start), resolveSession(token, {}, testDb.otherDb, start),
    ])
    expect(await resolveSession(token, {}, testDb.otherDb, start)).toBeNull()
    if (adopted) expect(await resolveSession(adopted.transport.token, {}, testDb.db, start)).toBeNull()
    // The independent connection sees the durable tombstone, not a process-local flag.
    const rows = await testDb.otherDb.select().from(authSessions)
    const legacy = rows.filter((row) => row.legacyTokenDigest !== null)
    expect(legacy).toHaveLength(1)
    expect(legacy[0].revokedAt).toEqual(start)
    expect(legacy[0].authenticatedAt).toEqual(at(-10))
  })
})
