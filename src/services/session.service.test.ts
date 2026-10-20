import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { SignJWT } from 'jose'
import { authSessions, users } from '../db/schema'
import { createAuthTestDatabase, type AuthTestDatabase } from '../test/auth-db'
import { verifySession } from '../lib/auth-utils'
import { createSession, reissueSession, resolveSession, revokeSession } from './session.service'

const start = new Date('2026-10-20T12:00:00Z')
const day = 86400
const at = (days: number) => new Date(start.getTime() + days * day * 1000)
const epoch = (value: Date) => value.getTime() / 1000
let testDb: AuthTestDatabase
let identity: { userId: string; email: string }

beforeAll(async () => {
  testDb = await createAuthTestDatabase()
  await testDb.addSessions()
  const [user] = await testDb.db.insert(users).values({ email: 'session@example.test' }).returning()
  identity = { userId: user.id, email: user.email }
}, 20000)
afterAll(async () => { await testDb?.close() })

describe('durable session policy', () => {
  it('renews beyond the old monthly boundary and caps at the original absolute deadline', async () => {
    let current = await createSession(identity, testDb.db, start)
    const original = current.session
    for (const days of [29, 58, 87, 89 + (day - 1) / day]) {
      const renewed = await resolveSession(current.transport.token, {}, testDb.db, at(days))
      expect(renewed).not.toBeNull()
      current = renewed!
      expect(current.session).toEqual(original)
      expect(current.transport.expiresAt).toBe(epoch(at(Math.min(days + 30, 90))))
      expect(await verifySession(current.transport.token, at(days))).toMatchObject({
        sessionId: original.sessionId, authenticatedAt: epoch(start), exp: current.transport.expiresAt,
      })
    }
    expect(await resolveSession(current.transport.token, {}, testDb.otherDb, at(90))).toBeNull()
    const [row] = await testDb.otherDb.select().from(authSessions).where(eq(authSessions.id, original.sessionId))
    expect(row.absoluteExpiresAt).toEqual(at(90))
    expect(row.authenticatedAt).toEqual(start)
  })

  it('fails exactly at inactivity expiry, without touching the durable row', async () => {
    const fresh = await createSession(identity, testDb.db, start)
    expect(await resolveSession(fresh.transport.token, {}, testDb.otherDb, at(30))).toBeNull()
    const [row] = await testDb.db.select().from(authSessions).where(eq(authSessions.id, fresh.session.sessionId))
    expect(row.lastActivityAt).toEqual(start)
  })

  it('does not touch rejected household authorization or read-only request context', async () => {
    const fresh = await createSession(identity, testDb.db, start)
    expect(await resolveSession(fresh.transport.token, { access: 'household' }, testDb.db, at(10))).toBeNull()
    expect(await resolveSession(fresh.transport.token, { touch: false }, testDb.db, at(10))).not.toBeNull()
    const [untouched] = await testDb.otherDb.select().from(authSessions).where(eq(authSessions.id, fresh.session.sessionId))
    expect(untouched.lastActivityAt).toEqual(start)
    expect(untouched.inactivityExpiresAt).toEqual(at(30))
    const admitted = await resolveSession(fresh.transport.token, { access: 'auth-only' }, testDb.db, at(10))
    expect(admitted?.transport.expiresAt).toBe(epoch(at(40)))
  })

  it('preserves identity and deadlines on household reissue; refuses reissue after revocation', async () => {
    const fresh = await createSession(identity, testDb.db, start)
    const householdId = '00000000-0000-4000-8000-000000000002'
    const reissued = await reissueSession(fresh.session, householdId, testDb.db, at(5))
    expect(reissued?.session).toEqual({ ...fresh.session, householdId })
    expect(reissued?.transport.expiresAt).toBe(fresh.transport.expiresAt)
    await revokeSession(fresh.transport.token, testDb.db, at(5))
    expect(await reissueSession(fresh.session, householdId, testDb.otherDb, at(5))).toBeNull()
  })

  it('creates sessions on the caller transaction and rolls them back with it (pool max 1)', async () => {
    const before = await testDb.db.select().from(authSessions)
    await expect(testDb.db.transaction(async (tx) => {
      await createSession(identity, tx, start)
      throw new Error('rollback fixture')
    })).rejects.toThrow('rollback fixture')
    expect(await testDb.db.select().from(authSessions)).toEqual(before)
  })

  it('revokes a renewed session when logout presents the transport that just expired', async () => {
    const original = await createSession(identity, testDb.db, start)
    const renewed = await resolveSession(original.transport.token, {}, testDb.otherDb, at(29))
    expect(renewed).not.toBeNull()
    expect(await resolveSession(original.transport.token, {}, testDb.db, at(30))).toBeNull()
    await revokeSession(original.transport.token, testDb.db, at(30))
    expect(await resolveSession(renewed!.transport.token, {}, testDb.otherDb, at(30))).toBeNull()
  })

  it('does not allow a tampered expired transport to revoke a valid renewed session', async () => {
    const original = await createSession(identity, testDb.db, start)
    const renewed = await resolveSession(original.transport.token, {}, testDb.otherDb, at(29))
    const [header, payload, signature] = original.transport.token.split('.')
    const tampered = `${header}.${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`
    await revokeSession(tampered, testDb.db, at(30))
    expect(await resolveSession(renewed!.transport.token, {}, testDb.otherDb, at(30))).not.toBeNull()
  })
})

describe('legacy adoption', () => {
  async function legacy(iat: number, exp: number) {
    return new SignJWT({ ...identity, iat, exp }).setProtectedHeader({ alg: 'HS256' })
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!))
  }

  it('adopts once across connections with the original iat and a domain-separated digest', async () => {
    const token = await legacy(epoch(at(-20)), epoch(at(10)))
    const [a, b] = await Promise.all([
      resolveSession(token, {}, testDb.db, start), resolveSession(token, {}, testDb.otherDb, start),
    ])
    expect(a?.session).toEqual(b?.session)
    expect(a?.session.authenticatedAt).toBe(epoch(at(-20)))
    expect(a?.transport.expiresAt).toBe(epoch(at(30)))
    const [row] = await testDb.db.select().from(authSessions).where(eq(authSessions.id, a!.session.sessionId))
    expect(row.absoluteExpiresAt).toEqual(at(70))
    expect(row.legacyExpiresAt).toEqual(at(10))
    expect(row.legacyTokenDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(row)).not.toContain(token)
  })

  it('does not turn an old but still signed JWT into a new inactivity clock', async () => {
    const token = await legacy(epoch(at(-31)), epoch(at(1)))
    expect(await resolveSession(token, {}, testDb.db, start)).toBeNull()
  })

  it('revokes an already adopted legacy session after its old transport expires without adopting expired tokens', async () => {
    const token = await legacy(epoch(at(-20)), epoch(at(10)))
    const adopted = await resolveSession(token, {}, testDb.db, start)
    expect(adopted).not.toBeNull()
    await revokeSession(token, testDb.otherDb, at(10))
    expect(await resolveSession(adopted!.transport.token, {}, testDb.db, at(10))).toBeNull()
    const before = await testDb.db.select().from(authSessions)
    const neverAdopted = await legacy(epoch(at(-30)), epoch(start))
    await revokeSession(neverAdopted, testDb.otherDb, start)
    expect(await testDb.db.select().from(authSessions)).toEqual(before)
  })
})
