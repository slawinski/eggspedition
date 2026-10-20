import assert from 'node:assert/strict'
import { createAuthTestDatabase } from '../src/test/auth-db'
import { webauthnFixture } from '../src/test/webauthn-fixture'
import { passkeys, users } from '../src/db/schema'
import { createSession } from '../src/services/session.service'
import { beginPasskeyAuthentication, beginPasskeyRegistration, finishPasskeyAuthentication, finishPasskeyRegistration } from '../src/services/passkey.service'

// Invoke with `bun --no-env-file run scripts/auth-passkey-smoke.ts` and ONLY an
// explicitly disposable AUTH_TEST_DATABASE_URL. Never loads application env/DB.
process.env.AUTH_SECRET = 'disposable-bun-smoke-only-secret-32-characters'
process.env.AUTH_WHITELIST = 'bun-smoke@example.test'
const origin = { expectedOrigin: 'https://example.test', rpID: 'example.test' }
const test = await createAuthTestDatabase()
try {
  const browser = await import('@simplewebauthn/browser')
  assert.equal(typeof browser.startAuthentication, 'function')
  assert.equal(typeof browser.startRegistration, 'function')
  await test.addAuthTables()
  const [user] = await test.db.insert(users).values({ email: process.env.AUTH_WHITELIST }).returning()
  const { session } = await createSession({ userId: user.id, email: user.email }, test.db)
  const fixture = webauthnFixture()
  const registration = await beginPasskeyRegistration(session, 'smoke-binding', origin, test.db)
  assert.equal((await finishPasskeyRegistration({ requestId: registration.requestId,
    response: fixture.registration(registration.optionsJSON.challenge, origin.expectedOrigin, origin.rpID) }, 'smoke-binding', origin, session, test.db)).status, 'registered')
  const [stored] = await test.otherDb.select().from(passkeys)
  assert.equal(stored.publicKey, fixture.publicKey)
  for (const counter of [0, 1]) {
    const options = await beginPasskeyAuthentication('smoke-binding', origin, test.otherDb)
    const result = await finishPasskeyAuthentication({ requestId: options.requestId,
      response: fixture.assertion(options.optionsJSON.challenge, origin.expectedOrigin, origin.rpID, user.id, counter) }, 'smoke-binding', origin, test.db)
    assert.equal(result.status, 'authenticated')
    assert.ok('session' in result && result.session.userId === user.id)
  }
  assert.equal((await test.otherDb.select().from(passkeys))[0].counter, 1)
  console.log(`Bun ${process.versions.bun}: actual server/browser imports, none registration, DB key round-trip, genuine ES256 assertions (zero and incrementing counters) passed`)
} finally { await test.close() }
