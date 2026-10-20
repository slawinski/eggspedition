import { createHmac, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../db/schema'
import { authSessions, emailCodes, households, magicLinks, memberships, users } from '../db/schema'
import { createAuthTestDatabase, type AuthTestDatabase } from '../test/auth-db'
import { requestEmailCode, verifyEmailCode, verifyMagicLink } from './auth.service'
import { verifySession } from '../lib/auth-utils'

const smtp = vi.hoisted(() => ({ sendMail: vi.fn() }))
vi.mock('nodemailer', () => ({ createTransport: () => smtp }))
let testDb: AuthTestDatabase
const email = 'shopper@example.test'
const binding = 'installation-binding-digest'
const start = new Date('2026-10-20T12:00:00Z')
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000)
const secret = 'disposable-email-test-secret'

beforeAll(async () => {
  testDb = await createAuthTestDatabase()
  await testDb.addSessions()
  await testDb.addAuthTables()
  await testDb.addAuthTables()
}, 20000)
beforeEach(async () => {
  await testDb.first.unsafe('TRUNCATE email_codes, auth_sessions, users, households, magic_links CASCADE')
  vi.stubEnv('AUTH_SECRET', secret)
  vi.stubEnv('AUTH_WHITELIST', email)
  vi.stubEnv('SMTP_USER', 'test')
  vi.stubEnv('SMTP_PASS', 'test')
  smtp.sendMail.mockReset().mockResolvedValue({ accepted: [email] })
})
afterEach(() => vi.unstubAllEnvs())
afterAll(async () => { await testDb?.close() })

function deliveredCode(index = 0): string {
  const mail = smtp.sendMail.mock.calls[index][0]
  expect(mail.text).toMatch(/\b\d{6}\b/)
  expect(mail.html).not.toMatch(/href|https?:|\/api\/auth/)
  return mail.text.match(/\b\d{6}\b/)![0]
}

async function issue(time = start, executor = testDb.db) {
  const result = await requestEmailCode(email, binding, executor, time)
  if (result.status !== 'sent') throw new Error(`Expected issuance, got ${result.status}`)
  return result
}

describe('U2 durable email authentication', () => {
  it('sends only an entered code, stores a domain-separated HMAC, and creates a fresh session in the same single-connection transaction', async () => {
    const sent = await issue()
    const code = deliveredCode()
    expect(sent).toEqual({ status: 'sent', requestId: expect.any(String), expiresAt: at(600).getTime(), resendAt: at(60).getTime() })
    const [row] = await testDb.otherDb.select().from(emailCodes)
    expect(row.codeDigest).toBe(createHmac('sha256', secret).update('eggspedition:email-code:v1\0').update(JSON.stringify([email, sent.requestId, code])).digest('hex'))
    expect(JSON.stringify(row)).not.toContain(`"${code}"`)
    const result = await verifyEmailCode({ requestId: sent.requestId, code }, binding, testDb.db, at(1))
    expect(result.status).toBe('authenticated')
    if (result.status !== 'authenticated') throw new Error('Authentication failed')
    expect(result.hasHousehold).toBe(false)
    expect(await verifySession(result.transport.token, at(1))).toMatchObject({ userId: result.session.userId, authenticatedAt: at(1).getTime() / 1000 })
    const [stored] = await testDb.otherDb.select().from(authSessions)
    expect(stored.authenticatedAt).toEqual(at(1))
    expect(stored.absoluteExpiresAt.getTime() - at(1).getTime()).toBe(90 * 86400_000)
    expect((await testDb.otherDb.select().from(emailCodes))[0].codeDigest).toBeNull()
    expect(await verifyEmailCode({ requestId: sent.requestId, code }, binding, testDb.otherDb, at(2))).toEqual({ status: 'consumed' })
  })

  it('verifies a leading-zero code without converting it to a number', async () => {
    const sent = await issue()
    const code = '000007'
    const codeDigest = createHmac('sha256', secret).update('eggspedition:email-code:v1\0').update(JSON.stringify([email, sent.requestId, code])).digest('hex')
    await testDb.db.update(emailCodes).set({ codeDigest }).where(eq(emailCodes.email, email))
    expect((await verifyEmailCode({ requestId: sent.requestId, code }, binding, testDb.db, at(1))).status).toBe('authenticated')
  })

  it('commits five wrong/malformed submissions across independent connections and refuses the correct code afterwards', async () => {
    const sent = await issue()
    const wrongCode = ((Number(deliveredCode()) + 1) % 1_000_000).toString().padStart(6, '0')
    for (let i = 0; i < 5; i++) {
      expect(await verifyEmailCode({ requestId: sent.requestId, code: i % 2 ? 'not-a-code' : wrongCode }, binding, i % 2 ? testDb.db : testDb.otherDb, at(1)))
        .toEqual(i === 4 ? { status: 'attempt_limit' } : { status: 'invalid', attemptsRemaining: 4 - i })
      expect((await testDb.otherDb.select().from(emailCodes))[0].attempts).toBe(i + 1)
    }
    // A newly opened client has no process-local issuance/attempt state to inherit.
    const [{ namespace }] = await testDb.first<{ namespace: string }[]>`select current_schema() as namespace`
    const reconnected = postgres(process.env.AUTH_TEST_DATABASE_URL!, { max: 1, connection: { search_path: namespace } })
    try {
      const db = drizzle(reconnected, { schema })
      expect((await db.select().from(emailCodes))[0].attempts).toBe(5)
      expect(await verifyEmailCode({ requestId: sent.requestId, code: deliveredCode() }, binding, db, at(2))).toEqual({ status: 'attempt_limit' })
    } finally { await reconnected.end() }
    expect(await testDb.db.select().from(authSessions)).toHaveLength(0)
  })

  it('rejects expiry, absent/copied binding and superseded generations without creating accounts', async () => {
    const first = await issue()
    const input = { requestId: first.requestId, code: deliveredCode() }
    expect(await verifyEmailCode(input, null, testDb.db, at(1))).toEqual({ status: 'invalid' })
    expect(await verifyEmailCode(input, 'other-installation', testDb.db, at(1))).toEqual({ status: 'invalid' })
    expect((await testDb.db.select().from(emailCodes))[0].attempts).toBe(0)
    expect(await verifyEmailCode(input, binding, testDb.db, at(600))).toEqual({ status: 'expired' })
    await issue(at(601))
    expect(await verifyEmailCode(input, binding, testDb.db, at(602))).toEqual({ status: 'invalid' })
    expect(await testDb.db.select().from(users)).toHaveLength(0)
  })

  it('serializes absent-row issuance, normalized resend limits and correct-code claims on two connections', async () => {
    const results = await Promise.all([
      requestEmailCode(' SHOPPER@EXAMPLE.TEST ', binding, testDb.db, start),
      requestEmailCode(email, binding, testDb.otherDb, start),
    ])
    expect(results.filter((r) => r.status === 'sent')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rate_limited')).toEqual([{ status: 'rate_limited', retryAfter: 60 }])
    expect(smtp.sendMail).toHaveBeenCalledTimes(1)
    const sent = results.find((r) => r.status === 'sent')!
    if (sent.status !== 'sent') throw new Error('No issuance')
    const input = { requestId: sent.requestId, code: deliveredCode() }
    const finished = await Promise.all([
      verifyEmailCode(input, binding, testDb.db, at(1)), verifyEmailCode(input, binding, testDb.otherDb, at(1)),
    ])
    expect(finished.map((r) => r.status).sort()).toEqual(['authenticated', 'consumed'])
    expect(await testDb.db.select().from(users)).toHaveLength(1)
    expect(await testDb.db.select().from(authSessions)).toHaveLength(1)
  })

  it('enforces persisted 60-second, 3/15-minute and 10/day windows without resetting history on resends', async () => {
    await issue()
    expect(await requestEmailCode(email, binding, testDb.otherDb, at(59))).toEqual({ status: 'rate_limited', retryAfter: 1 })
    await issue(at(60))
    expect((await issue(at(120))).resendAt).toBe(at(900).getTime())
    expect(await requestEmailCode(email, binding, testDb.otherDb, at(180))).toEqual({ status: 'rate_limited', retryAfter: 720 })
    // Three per hour fits the short window but eventually exhausts the durable day window.
    for (const second of [3600, 3660, 3720, 7200, 7260, 7320, 10800]) await issue(at(second), testDb.otherDb)
    expect(await requestEmailCode(email, binding, testDb.db, at(10860))).toEqual({ status: 'rate_limited', retryAfter: 75540 })
    expect((await testDb.db.select().from(emailCodes))[0].issuedAt).toHaveLength(10)
    await issue(at(86400))
    expect((await testDb.otherDb.select().from(emailCodes))[0].issuedAt).toHaveLength(10)
  })

  it('retains issuance limits on SMTP failure and invalidates its undelivered code', async () => {
    smtp.sendMail.mockRejectedValueOnce(new Error('private SMTP error'))
    expect(await requestEmailCode(email, binding, testDb.db, start)).toEqual({ status: 'delivery_failed', retryAfter: 60 })
    const [row] = await testDb.otherDb.select().from(emailCodes)
    expect(row.codeDigest).toBeNull()
    expect(row.issuedAt).toEqual([start.getTime()])
    expect(await verifyEmailCode({ requestId: row.generation!, code: deliveredCode() }, binding, testDb.db, at(1))).toEqual({ status: 'consumed' })
    expect(await requestEmailCode(email, binding, testDb.otherDb, at(1))).toEqual({ status: 'rate_limited', retryAfter: 59 })
    await issue(at(60))
  })

  it('does not hold a transaction during SMTP and an old failure cannot invalidate a successful newer generation', async () => {
    let rejectOld!: (error: Error) => void
    let started!: () => void
    const sending = new Promise<void>((resolve) => { started = resolve })
    smtp.sendMail.mockImplementationOnce(() => { started(); return new Promise((_resolve, reject) => { rejectOld = reject }) })
    const first = requestEmailCode(email, binding, testDb.db, start)
    await sending
    const second = await issue(at(60), testDb.otherDb)
    rejectOld(new Error('delayed failure'))
    expect(await first).toEqual({ status: 'delivery_failed', retryAfter: 60 })
    expect((await verifyEmailCode({ requestId: second.requestId, code: deliveredCode(1) }, binding, testDb.db, at(61))).status).toBe('authenticated')
  })

  it('checks admission again at completion; unadmitted issuance sends no email', async () => {
    expect(await requestEmailCode('denied@example.test', binding, testDb.db, start)).toEqual({ status: 'admission_denied' })
    expect(smtp.sendMail).not.toHaveBeenCalled()
    const sent = await issue()
    vi.stubEnv('AUTH_WHITELIST', '')
    expect(await verifyEmailCode({ requestId: sent.requestId, code: deliveredCode() }, binding, testDb.otherDb, at(1))).toEqual({ status: 'admission_denied' })
    expect(await testDb.db.select().from(authSessions)).toHaveLength(0)
  })

  it('restores a unique case-insensitive identity and its latest membership without changing its UUID or stored email', async () => {
    const [user] = await testDb.db.insert(users).values({ email: 'Shopper@Example.Test' }).returning()
    const [older, latest] = await testDb.db.insert(households).values([{ name: 'Old' }, { name: 'Latest' }]).returning()
    await testDb.db.insert(memberships).values({ userId: user.id, householdId: older.id, joinedAt: at(-100) })
    const sent = await issue()
    // Membership changes after issuance must be read at finish.
    await testDb.db.insert(memberships).values({ userId: user.id, householdId: latest.id, joinedAt: at(1) })
    const result = await verifyEmailCode({ requestId: sent.requestId, code: deliveredCode() }, binding, testDb.otherDb, at(2))
    expect(result).toMatchObject({ status: 'authenticated', hasHousehold: true, session: { userId: user.id, email: user.email, householdId: latest.id } })
    expect(await testDb.db.select().from(users)).toHaveLength(1)
  })

  it('rejects ambiguous case variants without merging and commits the consumed claim', async () => {
    await testDb.db.insert(users).values([{ email }, { email: 'Shopper@Example.Test' }])
    const sent = await issue()
    const input = { requestId: sent.requestId, code: deliveredCode() }
    expect(await verifyEmailCode(input, binding, testDb.db, at(1))).toEqual({ status: 'ambiguous_identity' })
    expect(await verifyEmailCode(input, binding, testDb.otherDb, at(2))).toEqual({ status: 'consumed' })
    expect(await testDb.db.select().from(users)).toHaveLength(2)
    expect(await testDb.db.select().from(authSessions)).toHaveLength(0)
  })

  it('keeps previously issued legacy links single-use and retains original admission semantics', async () => {
    vi.stubEnv('AUTH_WHITELIST', '')
    await testDb.db.insert(magicLinks).values([
      { email, token: randomUUID(), expiresAt: start },
      { email, token: 'old-valid-link', expiresAt: at(900) },
    ])
    const [expired] = await testDb.db.select().from(magicLinks).where(eq(magicLinks.expiresAt, start))
    expect(await verifyMagicLink(expired.token, testDb.db, start)).toBeNull()
    const results = await Promise.all([
      verifyMagicLink('old-valid-link', testDb.db, start), verifyMagicLink('old-valid-link', testDb.otherDb, start),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await testDb.db.select().from(authSessions)).toHaveLength(1)
  })
})
