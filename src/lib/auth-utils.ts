import { SignJWT, jwtVerify } from 'jose'
import { randomBytes } from 'crypto'
import { Session, sessionSchema } from './schemas'

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)

export async function signSession(session: Session) {
  return await new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d') // Sticky Sessions: 30 days
    .sign(secret)
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return sessionSchema.parse(payload)
  } catch (err) {
    return null
  }
}

export function generateToken() {
  return randomBytes(32).toString('hex')
}
