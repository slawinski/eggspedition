import { and, desc, eq, gt, isNull, lte } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import * as schema from '../db/schema'
import { authSessions, memberships, passkeys, users, webauthnChallenges } from '../db/schema'
import type { Session, PasskeyFinishResult, PasskeyRegistrationOptionsResult, PasskeyAuthenticationOptionsResult } from '../lib/schemas'
import { createSession, type SessionResult } from './session.service'
import { isEmailAdmitted } from './auth.service'

type Database = PostgresJsDatabase<typeof schema>
type Origin = { expectedOrigin: string; rpID: string }
type Finish<T> = { requestId: string; response: T }
type Rejection = Exclude<PasskeyFinishResult, { status: 'authenticated' } | { status: 'registered' }>
async function database(executor?: Database) { return executor ?? (await import('../db')).db }

async function saveChallenge(db: Database, bindingDigest: string, origin: Origin, challenge: string, purpose: 'registration' | 'authentication', now: Date, session?: Session) {
  // Bound cleanup to the installation being touched, not a global scheduled sweep.
  await db.delete(webauthnChallenges).where(and(eq(webauthnChallenges.bindingDigest, bindingDigest), lte(webauthnChallenges.expiresAt, now)))
  const [row] = await db.insert(webauthnChallenges).values({
    ...origin, challenge, purpose, bindingDigest, expiresAt: new Date(now.getTime() + 300_000),
    userId: session?.userId, sessionId: session?.sessionId,
  }).returning({ id: webauthnChallenges.id })
  return row.id
}

export async function beginPasskeyRegistration(session: Session, binding: string, origin: Origin, executor?: Database, now = new Date()): Promise<PasskeyRegistrationOptionsResult> {
  const db = await database(executor)
  const existing = await db.select().from(passkeys).where(eq(passkeys.userId, session.userId))
  const { generateRegistrationOptions } = await import('@simplewebauthn/server')
  const { extensions: _extensions, ...options } = await generateRegistrationOptions({
    rpName: 'Eggspedition', rpID: origin.rpID, userName: session.email,
    userID: new TextEncoder().encode(session.userId), attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' },
    excludeCredentials: existing.map(row => ({ id: row.credentialId })),
  })
  // Only credProps is used here. The DOM extension type also permits binary PRF
  // inputs, which are not this RPC's JSON contract.
  const optionsJSON = { ...options, extensions: { credProps: true } }
  return { status: 'options' as const, requestId: await saveChallenge(db, binding, origin, optionsJSON.challenge, 'registration', now, session), optionsJSON }
}

export async function beginPasskeyAuthentication(binding: string, origin: Origin, executor?: Database, now = new Date()): Promise<PasskeyAuthenticationOptionsResult> {
  const db = await database(executor)
  const { generateAuthenticationOptions } = await import('@simplewebauthn/server')
  const { extensions: _extensions, ...optionsJSON } = await generateAuthenticationOptions({ rpID: origin.rpID, userVerification: 'required' })
  // Omit the account allow-list entirely for discoverable sign-in.
  delete optionsJSON.allowCredentials
  return { status: 'options' as const, requestId: await saveChallenge(db, binding, origin, optionsJSON.challenge, 'authentication', now), optionsJSON }
}

/** Claims are committed on rejection too; never throw a crypto rejection out of the transaction. */
export async function finishPasskeyRegistration(input: Finish<RegistrationResponseJSON>, binding: string | null, origin: Origin, session: Session | null, executor?: Database, now = new Date()): Promise<Rejection | { status: 'registered' }> {
  const db = await database(executor)
  return db.transaction(async tx => {
    const [challenge] = await tx.delete(webauthnChallenges).where(and(eq(webauthnChallenges.id, input.requestId), eq(webauthnChallenges.bindingDigest, binding ?? ''))).returning()
    if (!challenge || challenge.purpose !== 'registration' || challenge.expiresAt <= now || challenge.expectedOrigin !== origin.expectedOrigin || challenge.rpID !== origin.rpID) return { status: 'invalid' }
    if (!session || session.userId !== challenge.userId || session.sessionId !== challenge.sessionId) return { status: 'unauthenticated' }
    // Lock authoritative session state so concurrent logout cannot pass the attachment check.
    const [active] = await tx.select().from(authSessions).where(and(
      eq(authSessions.id, session.sessionId), eq(authSessions.userId, session.userId),
      eq(authSessions.authenticatedAt, new Date(session.authenticatedAt * 1000)), isNull(authSessions.revokedAt),
      gt(authSessions.inactivityExpiresAt, now), gt(authSessions.absoluteExpiresAt, now),
    )).for('update')
    if (!active) return { status: 'unauthenticated' }
    const { verifyRegistrationResponse } = await import('@simplewebauthn/server')
    let verification
    try {
      verification = await verifyRegistrationResponse({ response: input.response, expectedChallenge: challenge.challenge,
        expectedOrigin: origin.expectedOrigin, expectedRPID: origin.rpID, requireUserVerification: true })
    } catch { return { status: 'invalid' } }
    if (!verification.verified || !verification.registrationInfo) return { status: 'invalid' }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
    const inserted = await tx.insert(passkeys).values({ credentialId: credential.id, userId: session.userId,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter,
      transports: credential.transports ?? [], deviceType: credentialDeviceType, backedUp: credentialBackedUp, createdAt: now,
    }).onConflictDoNothing().returning()
    return { status: inserted.length ? 'registered' : 'duplicate' }
  })
}

export async function finishPasskeyAuthentication(input: Finish<AuthenticationResponseJSON>, binding: string | null, origin: Origin, executor?: Database, now = new Date()): Promise<Rejection | ({ status: 'authenticated'; hasHousehold: boolean } & SessionResult)> {
  const db = await database(executor)
  return db.transaction(async tx => {
    const [challenge] = await tx.delete(webauthnChallenges).where(and(eq(webauthnChallenges.id, input.requestId), eq(webauthnChallenges.bindingDigest, binding ?? ''))).returning()
    if (!challenge || challenge.purpose !== 'authentication' || challenge.expiresAt <= now || challenge.expectedOrigin !== origin.expectedOrigin || challenge.rpID !== origin.rpID) return { status: 'invalid' }
    const [key] = await tx.select().from(passkeys).where(eq(passkeys.credentialId, input.response.id)).for('update')
    if (!key || input.response.response.userHandle !== Buffer.from(key.userId, 'utf8').toString('base64url')) return { status: 'invalid' }
    const { verifyAuthenticationResponse } = await import('@simplewebauthn/server')
    let verification
    try {
      verification = await verifyAuthenticationResponse({ response: input.response, expectedChallenge: challenge.challenge,
        expectedOrigin: origin.expectedOrigin, expectedRPID: origin.rpID, requireUserVerification: true,
        credential: { id: key.credentialId, publicKey: new Uint8Array(Buffer.from(key.publicKey, 'base64url')), counter: key.counter },
      })
    } catch { return { status: 'invalid' } }
    if (!verification.verified) return { status: 'invalid' }
    const [owner] = await tx.select().from(users).where(eq(users.id, key.userId))
    if (!owner || !isEmailAdmitted(owner.email)) return { status: 'admission_denied' }
    const [membership] = await tx.select().from(memberships).where(eq(memberships.userId, owner.id)).orderBy(desc(memberships.joinedAt)).limit(1)
    const info = verification.authenticationInfo
    await tx.update(passkeys).set({ counter: info.newCounter, lastUsedAt: now, deviceType: info.credentialDeviceType, backedUp: info.credentialBackedUp }).where(eq(passkeys.credentialId, key.credentialId))
    const result = await createSession({ userId: owner.id, email: owner.email, householdId: membership?.householdId }, tx, now)
    return { status: 'authenticated', hasHousehold: !!membership, ...result }
  })
}
