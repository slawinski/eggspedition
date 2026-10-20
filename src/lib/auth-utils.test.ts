import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'
import { verifySession } from './auth-utils'

const identity = { userId: '00000000-0000-4000-8000-000000000001', email: 'shopper@example.test' }
const now = new Date('2026-10-20T12:00:00Z')
const issuedAt = Math.floor(now.getTime() / 1000) - 20 * 86400

async function legacy(iat: number | null = issuedAt, exp = issuedAt + 30 * 86400) {
  return new SignJWT({ ...identity, ...(iat === null ? {} : { iat }), exp })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!))
}

afterEach(() => vi.useRealTimers())

describe('session JWT compatibility', () => {
  it('retains verified legacy issue time rather than starting a new clock', async () => {
    vi.useFakeTimers().setSystemTime(now)
    expect(await verifySession(await legacy())).toMatchObject({ ...identity, iat: issuedAt })
  })

  it('rejects legacy JWTs without an issue time', async () => {
    vi.useFakeTimers().setSystemTime(now)
    expect(await verifySession(await legacy(null))).toBeNull()
  })

  it('rejects expired and tampered legacy JWTs', async () => {
    vi.useFakeTimers().setSystemTime(now)
    expect(await verifySession(await legacy(issuedAt, Math.floor(now.getTime() / 1000)))).toBeNull()
    const token = await legacy()
    const [header, payload, signature] = token.split('.')
    expect(await verifySession(`${header}.${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`)).toBeNull()
  })
})
