import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../db/schema'
import { createAuthTestDatabase, type AuthTestDatabase } from '../test/auth-db'
import { webauthnFixture } from '../test/webauthn-fixture'
import { authSessions, households, memberships, passkeys, users, webauthnChallenges } from '../db/schema'
import { beginPasskeyAuthentication, beginPasskeyRegistration, finishPasskeyAuthentication, finishPasskeyRegistration } from './passkey.service'
import { createSession, revokeSession } from './session.service'

let test: AuthTestDatabase
const origin = { expectedOrigin: 'https://example.test', rpID: 'example.test' }
const binding = 'binding-digest'
const email = 'shopper@example.test'
beforeAll(async () => { test = await createAuthTestDatabase(); await test.addAuthTables(); await test.addAuthTables() }, 20000)
beforeEach(async () => {
  await test.first.unsafe('TRUNCATE users, households, auth_sessions, passkeys, webauthn_challenges CASCADE')
  vi.stubEnv('AUTH_SECRET', 'disposable-passkey-secret-at-least-32-characters')
  vi.stubEnv('AUTH_WHITELIST', email)
})
afterAll(async () => { vi.unstubAllEnvs(); await test?.close() })

async function enroll() {
  const [user] = await test.db.insert(users).values({ email }).returning()
  const session = await createSession({ userId: user.id, email }, test.db)
  const fixture = webauthnFixture()
  const options = await beginPasskeyRegistration(session.session, binding, origin, test.db)
  const response = fixture.registration(options.optionsJSON.challenge, origin.expectedOrigin, origin.rpID)
  expect(await finishPasskeyRegistration({ requestId: options.requestId, response }, binding, origin, session.session, test.db)).toEqual({ status: 'registered' })
  return { user, session, fixture }
}

it('registers a discoverable platform key, reloads it and authenticates the existing latest membership with genuine ES256 signatures and zero counters', async () => {
  const { user, session, fixture } = await enroll()
  const options = await beginPasskeyRegistration(session.session, binding, origin, test.db)
  expect(options.optionsJSON.user.id).toBe(Buffer.from(user.id).toString('base64url'))
  expect(options.optionsJSON).toMatchObject({ attestation: 'none', authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' }, excludeCredentials: [{ id: fixture.id }] })
  const [key] = await test.otherDb.select().from(passkeys)
  expect(key).toMatchObject({ publicKey: fixture.publicKey, counter: 0, transports: ['internal'], backedUp: true, deviceType: 'multiDevice' })
  const [home] = await test.db.insert(households).values({ name: 'Existing' }).returning()
  await test.db.insert(memberships).values({ userId: user.id, householdId: home.id })
  for (let i = 0; i < 2; i++) {
    const begin = await beginPasskeyAuthentication(binding, origin, test.db)
    const response = fixture.assertion(begin.optionsJSON.challenge, origin.expectedOrigin, origin.rpID, user.id)
    const results = await Promise.all([test.db, test.otherDb].map(db => finishPasskeyAuthentication({ requestId: begin.requestId, response }, binding, origin, db)))
    expect(results.filter(r => r.status === 'authenticated')).toHaveLength(1)
    expect(results.find(r => r.status === 'authenticated')).toMatchObject({ hasHousehold: true, session: { userId: user.id, householdId: home.id } })
  }
  expect(await test.db.select().from(users)).toHaveLength(1)
})

it.each(['challenge', 'origin', 'rp', 'signature', 'UV', 'handle', 'missing-handle', 'unknown', 'purpose', 'expired', 'binding', 'missing-binding', 'admission', 'configured-origin', 'configured-rp'])('rejects %s without session issuance; failed claims persist across connections', async bad => {
  const { user, fixture } = await enroll()
  const begin = await beginPasskeyAuthentication(binding, origin, test.db)
  const response = fixture.assertion(bad === 'challenge' ? 'wrong' : begin.optionsJSON.challenge,
    bad === 'origin' ? 'https://evil.test' : origin.expectedOrigin, bad === 'rp' ? 'evil.test' : origin.rpID,
    bad === 'handle' ? 'another-user' : user.id, 0, bad === 'UV' ? 0x19 : 0x1d)
  if (bad === 'signature') response.response.signature = Buffer.alloc(70).toString('base64url')
  if (bad === 'unknown') response.id = 'unknown'
  if (bad === 'missing-handle') delete response.response.userHandle
  if (bad === 'purpose') await test.db.update(webauthnChallenges).set({ purpose: 'registration' }).where(eq(webauthnChallenges.id, begin.requestId))
  if (bad === 'expired') await test.db.update(webauthnChallenges).set({ expiresAt: new Date(0) }).where(eq(webauthnChallenges.id, begin.requestId))
  if (bad === 'admission') vi.stubEnv('AUTH_WHITELIST', 'other@example.test')
  const configured = { expectedOrigin: bad === 'configured-origin' ? 'https://changed.test' : origin.expectedOrigin, rpID: bad === 'configured-rp' ? 'changed.test' : origin.rpID }
  const result = await finishPasskeyAuthentication({ requestId: begin.requestId, response }, bad === 'binding' ? 'copied' : bad === 'missing-binding' ? null : binding, configured, test.db)
  expect(result.status).toBe(bad === 'admission' ? 'admission_denied' : 'invalid')
  expect(await test.otherDb.select().from(authSessions)).toHaveLength(1)
  if (!bad.includes('binding')) {
    expect(await test.otherDb.select().from(webauthnChallenges)).toHaveLength(0)
    expect((await finishPasskeyAuthentication({ requestId: begin.requestId, response }, binding, origin, test.otherDb)).status).toBe('invalid')
  }
})

it('commits failed crypto consumption across a newly opened connection', async () => {
  const { user, fixture } = await enroll()
  const begin = await beginPasskeyAuthentication(binding, origin, test.db)
  const response = fixture.assertion(begin.optionsJSON.challenge, origin.expectedOrigin, origin.rpID, user.id)
  const broken = { ...response, response: { ...response.response, signature: Buffer.alloc(70).toString('base64url') } }
  expect((await finishPasskeyAuthentication({ requestId: begin.requestId, response: broken }, binding, origin, test.db)).status).toBe('invalid')
  const [{ namespace }] = await test.first<{ namespace: string }[]>`select current_schema() as namespace`
  const connection = postgres(process.env.AUTH_TEST_DATABASE_URL!, { max: 1, onnotice: () => {}, connection: { search_path: namespace } })
  try {
    const db = drizzle(connection, { schema })
    expect((await finishPasskeyAuthentication({ requestId: begin.requestId, response }, binding, origin, db)).status).toBe('invalid')
    expect(await db.select().from(authSessions)).toHaveLength(1)
  } finally { await connection.end() }
})

it('locks counters across independent challenge finishes and rejects nonzero rollback', async () => {
  const { user, fixture } = await enroll()
  const begins = await Promise.all([test.db, test.otherDb].map(db => beginPasskeyAuthentication(binding, origin, db)))
  const results = await Promise.all(begins.map((begin, i) => finishPasskeyAuthentication({ requestId: begin.requestId,
    response: fixture.assertion(begin.optionsJSON.challenge, origin.expectedOrigin, origin.rpID, user.id, 2) }, binding, origin, i ? test.otherDb : test.db)))
  expect(results.filter(r => r.status === 'authenticated')).toHaveLength(1)
  expect((await test.otherDb.select().from(passkeys))[0].counter).toBe(2)
  const begin = await beginPasskeyAuthentication(binding, origin, test.db)
  expect((await finishPasskeyAuthentication({ requestId: begin.requestId, response: fixture.assertion(begin.optionsJSON.challenge, origin.expectedOrigin, origin.rpID, user.id, 1) }, binding, origin, test.db)).status).toBe('invalid')
})

it.each(['logout', 'session', 'account', 'duplicate', 'UV', 'expired-session'])('registration %s cannot attach/reassign credentials or revoke the valid session', async bad => {
  const { user, session, fixture } = await enroll()
  const begin = await beginPasskeyRegistration(session.session, binding, origin, test.db)
  let current = session.session
  if (bad === 'logout') await revokeSession(session.transport.token, test.otherDb)
  if (bad === 'expired-session') await test.db.update(authSessions).set({ inactivityExpiresAt: new Date(0) }).where(eq(authSessions.id, session.session.sessionId))
  if (bad === 'session') current = (await createSession({ userId: user.id, email }, test.db)).session
  if (bad === 'account') {
    const [other] = await test.db.insert(users).values({ email: 'other@example.test' }).returning()
    current = (await createSession({ userId: other.id, email: other.email }, test.db)).session
  }
  const response = fixture.registration(begin.optionsJSON.challenge, origin.expectedOrigin, origin.rpID, bad === 'UV' ? 0x59 : 0x5d)
  const result = await finishPasskeyRegistration({ requestId: begin.requestId, response }, binding, origin, current, test.db)
  expect(result.status).toBe(bad === 'duplicate' ? 'duplicate' : bad === 'UV' ? 'invalid' : 'unauthenticated')
  expect((await test.otherDb.select().from(passkeys)).map(k => k.userId)).toEqual([user.id])
  expect((await test.otherDb.select().from(authSessions).where(eq(authSessions.id, current.sessionId)))[0].revokedAt !== null).toBe(bad === 'logout')
})

it('never reassigns a duplicate credential to a different authenticated owner', async () => {
  const { user, fixture } = await enroll()
  const [other] = await test.db.insert(users).values({ email: 'other@example.test' }).returning()
  const { session } = await createSession({ userId: other.id, email: other.email }, test.db)
  const begin = await beginPasskeyRegistration(session, binding, origin, test.db)
  expect(await finishPasskeyRegistration({ requestId: begin.requestId,
    response: fixture.registration(begin.optionsJSON.challenge, origin.expectedOrigin, origin.rpID) }, binding, origin, session, test.db)).toEqual({ status: 'duplicate' })
  expect((await test.otherDb.select().from(passkeys))[0].userId).toBe(user.id)
})

it.each(['challenge', 'origin', 'rp', 'purpose', 'binding', 'expired'])('registration rejects %s without storing a key and atomically consumes a bound finish', async bad => {
  const [user] = await test.db.insert(users).values({ email }).returning()
  const { session } = await createSession({ userId: user.id, email }, test.db)
  const fixture = webauthnFixture()
  const begin = await beginPasskeyRegistration(session, binding, origin, test.db)
  if (bad === 'purpose') await test.db.update(webauthnChallenges).set({ purpose: 'authentication' }).where(eq(webauthnChallenges.id, begin.requestId))
  if (bad === 'expired') await test.db.update(webauthnChallenges).set({ expiresAt: new Date(0) }).where(eq(webauthnChallenges.id, begin.requestId))
  const input = { requestId: begin.requestId, response: fixture.registration(bad === 'challenge' ? 'wrong' : begin.optionsJSON.challenge,
    bad === 'origin' ? 'https://evil.test' : origin.expectedOrigin, bad === 'rp' ? 'evil.test' : origin.rpID) }
  expect(await finishPasskeyRegistration(input, bad === 'binding' ? 'copied' : binding, origin, session, test.db)).toEqual({ status: 'invalid' })
  expect(await test.otherDb.select().from(passkeys)).toHaveLength(0)
  if (bad !== 'binding') expect(await finishPasskeyRegistration(input, binding, origin, session, test.otherDb)).toEqual({ status: 'invalid' })
})

it('concurrent registration replay yields one attachment', async () => {
  const [user] = await test.db.insert(users).values({ email }).returning()
  const { session } = await createSession({ userId: user.id, email }, test.db)
  const fixture = webauthnFixture()
  const begin = await beginPasskeyRegistration(session, binding, origin, test.db)
  const input = { requestId: begin.requestId, response: fixture.registration(begin.optionsJSON.challenge, origin.expectedOrigin, origin.rpID) }
  const results = await Promise.all([test.db, test.otherDb].map(db => finishPasskeyRegistration(input, binding, origin, session, db)))
  expect(results.map(r => r.status).sort()).toEqual(['invalid', 'registered'])
  expect(await test.otherDb.select().from(passkeys)).toHaveLength(1)
})
