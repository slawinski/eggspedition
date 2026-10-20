import { afterEach, expect, it, vi } from 'vitest'
import { beginPasskeyAuthentication } from './passkey.service'
import { createAuthTestDatabase } from '../test/auth-db'
import { webauthnChallenges } from '../db/schema'
import { authOrigin } from '../lib/auth-origin'

afterEach(() => vi.unstubAllEnvs())

it('derives the exact configured origin and stable hostname, never a request host', () => {
  vi.stubEnv('BASE_URL', 'https://example.test:8443/path')
  expect(authOrigin()).toEqual({ expectedOrigin: 'https://example.test:8443', rpID: 'example.test' })
  vi.stubEnv('BASE_URL', 'http://example.test')
  expect(() => authOrigin()).toThrow('HTTPS')
  vi.stubEnv('BASE_URL', 'http://localhost:3000')
  vi.stubEnv('NODE_ENV', 'development')
  expect(authOrigin().rpID).toBe('localhost')
  vi.stubEnv('NODE_ENV', 'production')
  expect(() => authOrigin()).toThrow('HTTPS')
})

it('offers email-free discoverable authentication and persists a five-minute bound challenge', async () => {
  const test = await createAuthTestDatabase()
  try {
    await test.addAuthTables()
    const now = new Date()
    const result = await beginPasskeyAuthentication('binding', { expectedOrigin: 'https://example.test', rpID: 'example.test' }, test.db, now)
    expect(result.optionsJSON.userVerification).toBe('required')
    expect(result.optionsJSON.allowCredentials).toBeUndefined()
    const rows = await test.otherDb.select().from(webauthnChallenges)
    expect(rows).toHaveLength(1)
    expect(rows[0].bindingDigest).toBe('binding')
    expect(rows[0].expiresAt.getTime() - now.getTime()).toBe(300_000)
  } finally { await test.close() }
})
