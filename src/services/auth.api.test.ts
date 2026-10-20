import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestHandler } from '@tanstack/start-server-core'
import { runWithStartContext } from '@tanstack/start-storage-context'
import { authSessions, emailCodes } from '../db/schema'
import { createAuthTestDatabase, type AuthTestDatabase } from '../test/auth-db'
import { loginServerFn, logoutServerFn, verifyEmailCodeServerFn, beginPasskeyRegistrationServerFn, finishPasskeyRegistrationServerFn, beginPasskeyAuthenticationServerFn, finishPasskeyAuthenticationServerFn } from './auth.api'
import { AUTH_BINDING_COOKIE, beginAuthBinding, readAuthBinding } from '../lib/auth-origin'
import { requestEmailCodeResultSchema, verifyEmailCodeResultSchema } from '../lib/schemas'
import { resolveSession } from './session.service'
import { webauthnFixture } from '../test/webauthn-fixture'

const smtp = vi.hoisted(() => ({ sendMail: vi.fn() }))
vi.mock('nodemailer', () => ({ createTransport: () => smtp }))
let testDb: AuthTestDatabase
vi.mock('../db', () => ({ get db() { return testDb.db } }))
const origin = 'https://eggspedition.example.test'
const email = 'shopper@example.test'
const start = new Date('2026-10-20T12:00:00Z')

beforeAll(async () => {
  testDb = await createAuthTestDatabase()
  await testDb.addAuthTables()
}, 20000)
beforeEach(async () => {
  await testDb.first.unsafe('TRUNCATE email_codes, auth_sessions, users CASCADE')
  vi.stubEnv('BASE_URL', origin)
  vi.stubEnv('AUTH_SECRET', 'disposable-adapter-test-secret')
  vi.stubEnv('AUTH_WHITELIST', email)
  vi.stubEnv('SMTP_USER', 'test')
  vi.stubEnv('SMTP_PASS', 'test')
  vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(start)
  smtp.sendMail.mockReset().mockResolvedValue({ accepted: [email] })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })
afterAll(async () => { await testDb?.close() })

/** Exercise actual Start functions and cookie/header storage; only DB wiring and SMTP are replaced. */
async function request(invoke: () => Promise<unknown>, options: { origin?: string | null; cookie?: string } = {}) {
  const headers = new Headers()
  if (options.origin !== null) headers.set('origin', options.origin ?? origin)
  if (options.cookie) headers.set('cookie', options.cookie)
  const handler = requestHandler(async (incoming) => runWithStartContext({
    request: incoming, startOptions: {}, contextAfterGlobalMiddlewares: {}, executedRequestMiddlewares: new Set(),
    getRouter: () => { throw new Error('Auth adapters must not need a router') },
  }, async () => {
    try { return Response.json(await invoke()) }
    catch (error) {
      if (error instanceof Response) return error
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
    }
  }))
  return handler(new Request(`${origin}/test`, { method: 'POST', headers }), {})
}

function cookie(response: Response, name: string) {
  const value = response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`))
  expect(value).toBeTruthy()
  return value!.split(';')[0]
}
function code(index = 0) { return smtp.sendMail.mock.calls[index][0].text.match(/\b\d{6}\b/)![0] as string }
async function begin() {
  const response = await request(() => loginServerFn({ data: { email, returnTo: '/list', invite: 'retained-client-intent' } }))
  const body = await response.json()
  expect(body.status).toBe('sent')
  return { response, body, bindingCookie: cookie(response, AUTH_BINDING_COOKIE) }
}

describe('U2 Start adapters', () => {
  it('returns only request metadata then writes a private HttpOnly session cookie, never a JWT/code in the DTO', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { response, body, bindingCookie } = await begin()
    expect(requestEmailCodeResultSchema.parse(body)).toEqual(body)
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'requestId', 'resendAt', 'status'])
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const ceremony = response.headers.getSetCookie().join(';')
    for (const option of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=900']) expect(ceremony).toContain(option)
    const [stored] = await testDb.otherDb.select().from(emailCodes)
    expect(stored.bindingDigest).not.toBe(bindingCookie.split('=')[1])
    const verified = await request(() => verifyEmailCodeServerFn({ data: { requestId: body.requestId, code: code() } }), { cookie: bindingCookie })
    const result = await verified.json()
    expect(result).toEqual({ status: 'authenticated', hasHousehold: false })
    expect(verifyEmailCodeResultSchema.parse(result)).toEqual(result)
    expect(verified.headers.get('cache-control')).toBe('private, no-store')
    const sessionCookie = cookie(verified, 'session_token')
    const transport = decodeURIComponent(sessionCookie.slice('session_token='.length))
    expect(await resolveSession(transport, {}, testDb.otherDb, start)).not.toBeNull()
    expect(verified.headers.get('set-cookie')).toContain('Max-Age=2592000')
    const replay = await request(() => verifyEmailCodeServerFn({ data: { requestId: body.requestId, code: code() } }), { cookie: bindingCookie })
    expect(await replay.json()).toEqual({ status: 'consumed' })
    expect(replay.headers.get('set-cookie')).toBeNull()
  })

  it.each([null, 'https://attacker.example.test', `${origin}/`, 'null', 'http://eggspedition.example.test'])('rejects non-exact or missing Origin %s before issuing or finishing', async (badOrigin) => {
    const rejected = await request(() => loginServerFn({ data: { email } }), { origin: badOrigin })
    expect(rejected.ok).toBe(false)
    expect(await rejected.json()).toEqual({ error: 'Invalid authentication origin' })
    expect(rejected.headers.get('cache-control')).toBe('private, no-store')
    expect(rejected.headers.get('set-cookie')).toBeNull()
    expect(smtp.sendMail).not.toHaveBeenCalled()
    const { body, bindingCookie } = await begin()
    const finish = await request(() => verifyEmailCodeServerFn({ data: { requestId: body.requestId, code: code() } }), { origin: badOrigin, cookie: bindingCookie })
    expect(finish.ok).toBe(false)
    expect(await testDb.db.select().from(authSessions)).toHaveLength(0)
  })

  it('rejects missing and copied binding cookies and persists wrong-code domain rejections without writing a session', async () => {
    const { body, bindingCookie } = await begin()
    const input = { requestId: body.requestId, code: code() }
    for (const value of [undefined, `${AUTH_BINDING_COOKIE}=${'A'.repeat(43)}`]) {
      const denied = await request(() => verifyEmailCodeServerFn({ data: input }), { cookie: value })
      expect(await denied.json()).toEqual({ status: 'invalid' })
      expect(denied.headers.get('set-cookie')).toBeNull()
    }
    const wrong = await request(() => verifyEmailCodeServerFn({ data: { ...input, code: '12345' } }), { cookie: bindingCookie })
    expect(await wrong.json()).toEqual({ status: 'invalid', attemptsRemaining: 4 })
    expect(wrong.headers.get('cache-control')).toBe('private, no-store')
    expect(wrong.headers.get('set-cookie')).toBeNull()
    expect((await testDb.otherDb.select().from(emailCodes))[0].attempts).toBe(1)
  })

  it('refreshes the shared binding lifetime without changing its digest, and reading does not create a missing cookie', async () => {
    const missing = await request(async () => ({ digest: readAuthBinding() }))
    expect(await missing.json()).toEqual({ digest: null })
    expect(missing.headers.get('set-cookie')).toBeNull()
    const first = await request(async () => ({ digest: beginAuthBinding() }))
    const firstBody = await first.json()
    const bindingCookie = cookie(first, AUTH_BINDING_COOKIE)
    vi.setSystemTime(new Date(start.getTime() + 60_000))
    const refresh = await request(async () => ({ digest: beginAuthBinding() }), { cookie: bindingCookie })
    expect(await refresh.json()).toEqual(firstBody)
    expect(cookie(refresh, AUTH_BINDING_COOKIE)).toBe(bindingCookie)
    expect(refresh.headers.get('set-cookie')).toContain('Max-Age=900')
  })

  it('returns admission, delivery and durable rate-limit outcomes as private domain DTOs', async () => {
    const denied = await request(() => loginServerFn({ data: { email: 'denied@example.test' } }))
    expect(await denied.json()).toEqual({ status: 'admission_denied' })
    smtp.sendMail.mockRejectedValueOnce(new Error('SMTP secret failure'))
    const failed = await request(() => loginServerFn({ data: { email } }))
    expect(await failed.json()).toEqual({ status: 'delivery_failed', retryAfter: 60 })
    const limited = await request(() => loginServerFn({ data: { email } }))
    expect(await limited.json()).toEqual({ status: 'rate_limited', retryAfter: 60 })
    for (const response of [denied, failed, limited]) expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await testDb.db.select().from(authSessions)).toHaveLength(0)
  })

  it('origin-protects logout without weakening successful revocation', async () => {
    const { body, bindingCookie } = await begin()
    const finish = await request(() => verifyEmailCodeServerFn({ data: { requestId: body.requestId, code: code() } }), { cookie: bindingCookie })
    const sessionCookie = cookie(finish, 'session_token')
    const token = decodeURIComponent(sessionCookie.slice('session_token='.length))
    const rejected = await request(() => logoutServerFn(), { origin: null, cookie: sessionCookie })
    expect(rejected.ok).toBe(false)
    expect(await resolveSession(token, {}, testDb.otherDb, start)).not.toBeNull()
    const logout = await request(() => logoutServerFn(), { cookie: sessionCookie })
    expect(await logout.json()).toEqual({ success: true })
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(await resolveSession(token, {}, testDb.otherDb, start)).toBeNull()
  })
})

describe('U3 Start passkey adapters', () => {
  it('enrolls from the cookie session and returns only options/status DTOs, then signs in without email and writes the private session cookie', async () => {
    const { body, bindingCookie } = await begin()
    const verified = await request(() => verifyEmailCodeServerFn({ data: { requestId: body.requestId, code: code() } }), { cookie: bindingCookie })
    const sessionCookie = cookie(verified, 'session_token')
    const registration = await request(() => beginPasskeyRegistrationServerFn(), { cookie: `${bindingCookie}; ${sessionCookie}` })
    const options = await registration.json()
    expect(Object.keys(options).sort()).toEqual(['optionsJSON', 'requestId', 'status'])
    expect(registration.headers.get('cache-control')).toBe('private, no-store')
    const fixture = webauthnFixture()
    const registered = await request(() => finishPasskeyRegistrationServerFn({ data: { requestId: options.requestId,
      response: fixture.registration(options.optionsJSON.challenge, origin, new URL(origin).hostname) } }), { cookie: `${bindingCookie}; ${sessionCookie}` })
    expect(await registered.json()).toEqual({ status: 'registered' })
    const authentication = await request(() => beginPasskeyAuthenticationServerFn(), { cookie: bindingCookie })
    const authOptions = await authentication.json()
    expect(authOptions.optionsJSON.allowCredentials).toBeUndefined()
    const userId = Buffer.from(options.optionsJSON.user.id, 'base64url').toString('utf8')
    const input = { requestId: authOptions.requestId, response: fixture.assertion(authOptions.optionsJSON.challenge, origin, new URL(origin).hostname, userId) }
    const authenticated = await request(() => finishPasskeyAuthenticationServerFn({ data: input }), { cookie: bindingCookie })
    expect(await authenticated.json()).toEqual({ status: 'authenticated', hasHousehold: false })
    expect(authenticated.headers.get('cache-control')).toBe('private, no-store')
    expect(cookie(authenticated, 'session_token')).toBeTruthy()
    expect(authenticated.headers.get('set-cookie')).toContain('HttpOnly')
    const replay = await request(() => finishPasskeyAuthenticationServerFn({ data: input }), { cookie: bindingCookie })
    expect(await replay.json()).toEqual({ status: 'invalid' })
    expect(replay.headers.get('set-cookie')).toBeNull()
  })

  it('requires authentication for registration while anonymous options and email fallback remain available', async () => {
    const denied = await request(() => beginPasskeyRegistrationServerFn())
    expect(await denied.json()).toEqual({ status: 'unauthenticated' })
    expect(denied.headers.get('cache-control')).toBe('private, no-store')
    const options = await request(() => beginPasskeyAuthenticationServerFn())
    const body = await options.json()
    const fixture = webauthnFixture()
    const failure = await request(() => finishPasskeyAuthenticationServerFn({ data: { requestId: body.requestId,
      response: fixture.assertion(body.optionsJSON.challenge, origin, new URL(origin).hostname, 'unknown') } }))
    expect(await failure.json()).toEqual({ status: 'invalid' })
    expect(failure.headers.get('set-cookie')).toBeNull()
    expect((await begin()).body.status).toBe('sent')
  })

  it.each([null, 'https://evil.test'])('origin protects all passkey adapters (%s)', async badOrigin => {
    const fixture = webauthnFixture()
    const input = { requestId: '00000000-0000-4000-8000-000000000000' }
    const calls = [
      () => beginPasskeyRegistrationServerFn(),
      () => beginPasskeyAuthenticationServerFn(),
      () => finishPasskeyRegistrationServerFn({ data: { ...input, response: fixture.registration('challenge', origin, new URL(origin).hostname) } }),
      () => finishPasskeyAuthenticationServerFn({ data: { ...input, response: fixture.assertion('challenge', origin, new URL(origin).hostname, 'unknown') } }),
    ]
    for (const invoke of calls) {
      const result = await request(invoke, { origin: badOrigin })
      expect(result.status).toBe(403)
      expect(result.headers.get('cache-control')).toBe('private, no-store')
      expect(result.headers.get('set-cookie')).toBeNull()
    }
  })
})
