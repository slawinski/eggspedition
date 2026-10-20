import { deleteCookie, getCookie, setCookie, setResponseHeader } from '@tanstack/react-start/server'
import type { SessionTransport } from './schemas'
import { reissueSession, resolveSession, type SessionAccess } from '../services/session.service'
import type { Session } from './schemas'

export function privateSessionResponse() {
  setResponseHeader('Cache-Control', 'private, no-store')
}

export function writeSessionCookie(transport: SessionTransport, now = new Date()) {
  privateSessionResponse()
  setCookie('session_token', transport.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, transport.expiresAt - Math.floor(now.getTime() / 1000)),
    expires: new Date(transport.expiresAt * 1000),
  })
}

export function clearSessionCookie() {
  privateSessionResponse()
  deleteCookie('session_token', { path: '/' })
}

export async function readSessionCookie(access: SessionAccess = 'session', touch = true) {
  privateSessionResponse()
  const token = getCookie('session_token')
  const result = token ? await resolveSession(token, { access, touch }) : null
  if (result && touch) writeSessionCookie(result.transport)
  return result?.session ?? null
}

export async function reissueHouseholdCookie(session: Session, householdId: string) {
  const result = await reissueSession(session, householdId)
  if (!result) throw new Error('Unauthorized')
  writeSessionCookie(result.transport)
}
