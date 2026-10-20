import { createHash } from 'node:crypto'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema'
import { authSessions } from '../db/schema'
import { signSession, verifySession, verifyRevocationToken } from '../lib/auth-utils'
import { sessionIdentitySchema, type Session, type SessionIdentity, type SessionTransport } from '../lib/schemas'

export type SessionDatabase = Pick<PostgresJsDatabase<typeof schema>, 'select' | 'insert' | 'update' | 'delete'>
export type SessionResult = { session: Session; transport: SessionTransport }
export type SessionAccess = 'session' | 'auth-only' | 'household'

export const SESSION_IDLE_SECONDS = 30 * 86400
export const SESSION_ABSOLUTE_SECONDS = 90 * 86400

async function database(executor?: SessionDatabase): Promise<SessionDatabase> {
  return executor ?? (await import('../db')).db
}

function seconds(now: Date) { return Math.floor(now.getTime() / 1000) }
function date(value: number) { return new Date(value * 1000) }
function legacyDigest(token: string) {
  return createHash('sha256').update('eggspedition:legacy-session:v1\0').update(token).digest('hex')
}

async function result(identity: SessionIdentity, row: typeof authSessions.$inferSelect, now: Date): Promise<SessionResult> {
  const session = {
    ...sessionIdentitySchema.parse(identity),
    sessionId: row.id,
    authenticatedAt: seconds(row.authenticatedAt),
  }
  const expiresAt = Math.min(seconds(row.inactivityExpiresAt), seconds(row.absoluteExpiresAt))
  return { session, transport: { token: await signSession(session, expiresAt, now), expiresAt } }
}

/** Fresh authentication only. Pass the caller's transaction when claiming a credential. */
export async function createSession(identity: SessionIdentity, executor?: SessionDatabase, now = new Date()): Promise<SessionResult> {
  const db = await database(executor)
  const authenticatedAt = seconds(now)
  const [row] = await db.insert(authSessions).values({
    userId: identity.userId,
    authenticatedAt: date(authenticatedAt),
    lastActivityAt: date(authenticatedAt),
    inactivityExpiresAt: date(authenticatedAt + SESSION_IDLE_SECONDS),
    absoluteExpiresAt: date(authenticatedAt + SESSION_ABSOLUTE_SECONDS),
  }).returning()
  return result(identity, row, now)
}

async function findSession(token: string, db: SessionDatabase, now: Date, access: SessionAccess) {
  const claims = await verifySession(token, now)
  if (!claims || (access === 'household' && !claims.householdId)) return null
  if (claims.sessionId !== undefined) return { claims, id: claims.sessionId, authenticatedAt: claims.authenticatedAt }

  const digest = legacyDigest(token)
  // The unique digest serializes initially absent rows, including concurrent logout/adoption.
  await db.insert(authSessions).values({
    userId: claims.userId,
    authenticatedAt: date(claims.iat),
    lastActivityAt: date(claims.iat),
    inactivityExpiresAt: date(Math.min(claims.exp, claims.iat + SESSION_IDLE_SECONDS)),
    absoluteExpiresAt: date(claims.iat + SESSION_ABSOLUTE_SECONDS),
    legacyTokenDigest: digest,
    legacyExpiresAt: date(claims.exp),
  }).onConflictDoNothing({ target: authSessions.legacyTokenDigest })
  const [row] = await db.select().from(authSessions).where(eq(authSessions.legacyTokenDigest, digest))
  return { claims, id: row.id, authenticatedAt: claims.iat }
}

/** Shared authorization resolver. Only admitted activity may touch the durable clock. */
export async function resolveSession(
  token: string,
  options: { access?: SessionAccess; touch?: boolean } = {},
  executor?: SessionDatabase,
  now = new Date(),
): Promise<SessionResult | null> {
  const db = await database(executor)
  const found = await findSession(token, db, now, options.access ?? 'session')
  if (!found) return null
  const at = date(seconds(now))
  const eligible = and(
    eq(authSessions.id, found.id), eq(authSessions.userId, found.claims.userId),
    eq(authSessions.authenticatedAt, date(found.authenticatedAt)),
    isNull(authSessions.revokedAt), gt(authSessions.inactivityExpiresAt, at), gt(authSessions.absoluteExpiresAt, at),
  )
  const [row] = options.touch === false
    ? await db.select().from(authSessions).where(eligible)
    : await db.update(authSessions).set({
      lastActivityAt: sql`greatest(${authSessions.lastActivityAt}, ${sql.param(at, authSessions.lastActivityAt)})`,
      inactivityExpiresAt: sql`least(${authSessions.absoluteExpiresAt}, greatest(${authSessions.inactivityExpiresAt}, ${sql.param(date(seconds(now) + SESSION_IDLE_SECONDS), authSessions.inactivityExpiresAt)}))`,
    }).where(eligible).returning()
  return row ? result(found.claims, row, now) : null
}

/** Change only household context; resolving again prevents a reissue from bypassing logout. */
export async function reissueSession(session: Session, householdId: string, executor?: SessionDatabase, now = new Date()) {
  const db = await database(executor)
  const [row] = await db.select().from(authSessions).where(and(
    eq(authSessions.id, session.sessionId), eq(authSessions.userId, session.userId),
    eq(authSessions.authenticatedAt, date(session.authenticatedAt)),
    isNull(authSessions.revokedAt), gt(authSessions.inactivityExpiresAt, date(seconds(now))),
    gt(authSessions.absoluteExpiresAt, date(seconds(now))),
  ))
  return row ? result({ ...session, householdId }, row, now) : null
}

export async function revokeSession(token: string, executor?: SessionDatabase, now = new Date()): Promise<void> {
  const db = await database(executor)
  const claims = await verifyRevocationToken(token, now)
  if (!claims) return
  // Adopt only a still-valid legacy token. An expired one may identify an
  // existing adoption, but must never create a fresh durable session.
  if (claims.sessionId === undefined && claims.exp > seconds(now)) await findSession(token, db, now, 'session')
  const identity = claims.sessionId !== undefined
    ? and(eq(authSessions.id, claims.sessionId), eq(authSessions.authenticatedAt, date(claims.authenticatedAt)))
    : and(eq(authSessions.legacyTokenDigest, legacyDigest(token)), eq(authSessions.authenticatedAt, date(claims.iat)))
  await db.update(authSessions).set({ revokedAt: date(seconds(now)) })
    .where(and(identity, eq(authSessions.userId, claims.userId), isNull(authSessions.revokedAt)))
}
