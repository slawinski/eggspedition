import { createHash, randomBytes } from 'node:crypto'
import { getCookie, getRequestHeader, setCookie, setResponseHeader } from '@tanstack/react-start/server'

export const AUTH_BINDING_COOKIE = 'auth_ceremony'
export const AUTH_BINDING_SECONDS = 15 * 60

/** Configuration, not request Host/proxy headers, defines the WebAuthn trust boundary. */
export function authOrigin() {
  const base = new URL(process.env.BASE_URL || '')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && local && process.env.NODE_ENV !== 'production'))) {
    throw new Error('BASE_URL must use HTTPS (HTTP localhost is allowed only outside production)')
  }
  return { expectedOrigin: base.origin, rpID: base.hostname }
}

export function requireAuthOrigin() {
  setResponseHeader('Cache-Control', 'private, no-store')
  if (getRequestHeader('origin') !== authOrigin().expectedOrigin) {
    // Explicit Response headers survive Start's non-2xx/error conversion too.
    throw Response.json({ error: 'Invalid authentication origin' }, {
      status: 403, headers: { 'Cache-Control': 'private, no-store' },
    })
  }
}

function bindingDigest(secret: string) {
  return createHash('sha256').update('eggspedition:auth-binding:v1\0').update(secret).digest('hex')
}

function readBindingSecret() {
  const value = getCookie(AUTH_BINDING_COOKIE)
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
}

/** Begin: reuse the installation secret and refresh its lifetime; return ONLY its digest. */
export function beginAuthBinding(): string {
  setResponseHeader('Cache-Control', 'private, no-store')
  const secret = readBindingSecret() ?? randomBytes(32).toString('base64url')
  setCookie(AUTH_BINDING_COOKIE, secret, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: AUTH_BINDING_SECONDS,
  })
  return bindingDigest(secret)
}

/** Finish: never creates/refreshes a missing cookie. U3 persists and compares this digest too. */
export function readAuthBinding(): string | null {
  setResponseHeader('Cache-Control', 'private, no-store')
  const secret = readBindingSecret()
  return secret ? bindingDigest(secret) : null
}
