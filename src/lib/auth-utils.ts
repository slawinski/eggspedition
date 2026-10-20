import { SignJWT, compactVerify, jwtVerify } from 'jose'
import { randomBytes } from 'crypto'
import type { Session } from './schemas'
import { legacySessionClaimsSchema, sessionClaimsSchema } from './schemas'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)

export async function signSession(session: Session, expiresAt: number, now = new Date()) {
  const claims = sessionClaimsSchema.omit({ iat: true, exp: true }).parse(session)
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(expiresAt)
    .sign(secret)
}

export async function verifySession(token: string, now = new Date()) {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'], currentDate: now, requiredClaims: ['iat', 'exp'],
    })
    return parseSessionClaims(payload, now)
  } catch (err) {
    return null
  }
}

function parseSessionClaims(payload: unknown, now: Date) {
  if (!payload || typeof payload !== 'object') return null
  const claims = ('sessionId' in payload || 'authenticatedAt' in payload)
    ? sessionClaimsSchema.parse(payload)
    : legacySessionClaimsSchema.parse(payload)
  if (claims.iat > Math.floor(now.getTime() / 1000) || claims.exp <= claims.iat) return null
  if (claims.authenticatedAt !== undefined && claims.authenticatedAt > claims.iat) return null
  return claims
}

/** Identification for logout only: an expired signed transport may still name a renewed session. */
export async function verifyRevocationToken(token: string, now = new Date()) {
  try {
    const { payload } = await compactVerify(token, secret, { algorithms: ['HS256'] })
    return parseSessionClaims(JSON.parse(new TextDecoder().decode(payload)), now)
  } catch {
    return null
  }
}

export function generateToken() {
  return randomBytes(32).toString('hex')
}
