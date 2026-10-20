import { createTransport, type Transporter } from 'nodemailer'
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import type { db as applicationDb } from '../db'
import { users, magicLinks, memberships, emailCodes } from '../db/schema'
import { eq, and, gt, desc, sql } from 'drizzle-orm'
import { loginSchema } from '../lib/auth-inputs'
import { verifyEmailCodeSchema, type RequestEmailCodeResult, type VerifyEmailCodeResult } from '../lib/schemas'
import { createSession, type SessionDatabase, type SessionResult } from './session.service'

let _transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (_transporter) return _transporter

  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    throw new Error(
      'Missing SMTP credentials. Ensure SMTP_USER and SMTP_PASS are set in your .env file.'
    )
  }

  _transporter = createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user, pass },
  })

  return _transporter
}

/** Shared admission policy for email and passkey completion. Legacy links intentionally bypass it. */
export function isEmailAdmitted(email: string): boolean {
  const raw = process.env.AUTH_WHITELIST || ''
  const allowed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  return allowed.includes(email.trim().toLowerCase())
}

const minute = 60_000
const day = 24 * 60 * minute

function nextIssuanceAt(history: number[], time: number) {
  const recent = history.filter((at) => at > time - 15 * minute)
  return Math.max(
    history.length ? history[history.length - 1] + minute : 0,
    recent.length >= 3 ? recent[recent.length - 3] + 15 * minute : 0,
    history.length >= 10 ? history[history.length - 10] + day : 0,
  )
}

function codeDigest(email: string, generation: string, code: string) {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('Missing AUTH_SECRET')
  return createHmac('sha256', secret).update('eggspedition:email-code:v1\0')
    .update(JSON.stringify([email, generation, code])).digest('hex')
}

function equalDigest(a: string, b: string) {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Requires the caller's email lock. Never merge or replace existing UUIDs. */
export async function resolveEmailIdentity(email: string, tx: SessionDatabase) {
  let matches = await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(2)
  if (matches.length > 1) return null
  if (!matches.length) {
    await tx.insert(users).values({ email }).onConflictDoNothing({ target: users.email })
    matches = await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(2)
  }
  if (matches.length !== 1) return null
  const user = matches[0]
  const [membership] = await tx.select().from(memberships).where(eq(memberships.userId, user.id))
    .orderBy(desc(memberships.joinedAt)).limit(1)
  return { userId: user.id, email: user.email, householdId: membership?.householdId }
}

export async function requestEmailCode(
  emailInput: string,
  bindingDigest: string,
  executor?: typeof applicationDb,
  now = new Date(),
): Promise<RequestEmailCodeResult> {
  const parsed = loginSchema.safeParse({ email: emailInput })
  if (!parsed.success || !bindingDigest) return { status: 'invalid_input' }
  const email = parsed.data.email
  if (!isEmailAdmitted(email)) return { status: 'admission_denied' }
  const db = executor ?? (await import('../db')).db
  const generation = randomUUID()
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  const digest = codeDigest(email, generation, code)
  const issued = await db.transaction(async (tx): Promise<RequestEmailCodeResult> => {
    // INSERT also serializes two issuers when there was no row to lock yet.
    await tx.insert(emailCodes).values({ email }).onConflictDoNothing({ target: emailCodes.email })
    const [row] = await tx.select().from(emailCodes).where(eq(emailCodes.email, email)).for('update')
    const time = now.getTime()
    const history = row.issuedAt.filter((at) => at > time - day).sort((a, b) => a - b)
    const next = nextIssuanceAt(history, time)
    if (next > time) return { status: 'rate_limited', retryAfter: Math.ceil((next - time) / 1000) }
    const expiresAt = time + 10 * minute
    await tx.update(emailCodes).set({
      generation, codeDigest: digest, bindingDigest, expiresAt: new Date(expiresAt),
      consumedAt: null, attempts: 0, issuedAt: [...history, time],
    }).where(eq(emailCodes.email, email))
    return { status: 'sent', requestId: generation, expiresAt, resendAt: nextIssuanceAt([...history, time], time) }
  })
  if (issued.status !== 'sent') return issued
  // SMTP must never hold the database lock (or the single-connection application pool).
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'Eggspedition <noreply@example.com>', to: email,
      subject: 'Your Eggspedition sign-in code',
      text: `Your Eggspedition sign-in code is ${code}. Enter it in the app where you requested it. It expires in 10 minutes.`,
      html: `<p>Your Eggspedition sign-in code is <strong>${code}</strong>.</p><p>Enter it in the app where you requested it. It expires in 10 minutes.</p>`,
    })
  } catch {
    // An older delivery failure cannot invalidate a newer successfully delivered resend.
    await db.update(emailCodes).set({ codeDigest: null, consumedAt: now })
      .where(and(eq(emailCodes.email, email), eq(emailCodes.generation, generation)))
    return { status: 'delivery_failed', retryAfter: Math.max(1, Math.ceil((issued.resendAt - now.getTime()) / 1000)) }
  }
  return issued
}

export type EmailCodeVerification = Exclude<VerifyEmailCodeResult, { status: 'authenticated' }>
  | ({ status: 'authenticated'; hasHousehold: boolean } & SessionResult)

export async function verifyEmailCode(
  input: { requestId: string; code: string },
  bindingDigest: string | null,
  executor?: typeof applicationDb,
  now = new Date(),
): Promise<EmailCodeVerification> {
  if (!verifyEmailCodeSchema.safeParse(input).success || !bindingDigest) return { status: 'invalid' }
  const db = executor ?? (await import('../db')).db
  return db.transaction(async (tx): Promise<EmailCodeVerification> => {
    const [found] = await tx.select({ email: emailCodes.email }).from(emailCodes)
      .where(eq(emailCodes.generation, input.requestId))
    if (!found) return { status: 'invalid' }
    await tx.insert(emailCodes).values({ email: found.email }).onConflictDoNothing({ target: emailCodes.email })
    const [row] = await tx.select().from(emailCodes).where(eq(emailCodes.email, found.email)).for('update')
    if (row.generation !== input.requestId || row.bindingDigest !== bindingDigest) return { status: 'invalid' }
    if (row.consumedAt || !row.codeDigest) return { status: 'consumed' }
    if (!row.expiresAt || row.expiresAt <= now) return { status: 'expired' }
    if (row.attempts >= 5) return { status: 'attempt_limit' }
    if (!isEmailAdmitted(row.email)) return { status: 'admission_denied' }
    if (!/^\d{6}$/.test(input.code) || !equalDigest(row.codeDigest, codeDigest(row.email, input.requestId, input.code))) {
      const attempts = row.attempts + 1
      await tx.update(emailCodes).set({ attempts }).where(eq(emailCodes.email, row.email))
      // Return, don't throw: the rejected response must COMMIT this increment.
      return attempts >= 5 ? { status: 'attempt_limit' } : { status: 'invalid', attemptsRemaining: 5 - attempts }
    }
    await tx.update(emailCodes).set({ consumedAt: now, codeDigest: null }).where(eq(emailCodes.email, row.email))
    const identity = await resolveEmailIdentity(row.email, tx)
    if (!identity) return { status: 'ambiguous_identity' }
    const result = await createSession(identity, tx, now)
    return { status: 'authenticated', hasHousehold: !!identity.householdId, ...result }
  })
}

export async function verifyMagicLink(
  token: string,
  executor?: typeof applicationDb,
  now = new Date(),
) {
  const db = executor ?? (await import('../db')).db
  return db.transaction(async (tx) => {
    // Claim and identity/session creation commit together; concurrent consumers lose the delete.
    const [record] = await tx.delete(magicLinks)
      .where(and(eq(magicLinks.token, token), gt(magicLinks.expiresAt, now))).returning()
    if (!record) return null

    // Preserve the legacy endpoint's existing identity/admission semantics.
    await tx.insert(users).values({ email: record.email }).onConflictDoNothing({ target: users.email })
    const [user] = await tx.select().from(users).where(eq(users.email, record.email)).limit(1)
    const [membership] = await tx.select().from(memberships)
      .where(eq(memberships.userId, user.id)).orderBy(desc(memberships.joinedAt)).limit(1)
    const result = await createSession({
      userId: user.id, email: user.email, householdId: membership?.householdId,
    }, tx, now)
    return { ...result, hasHousehold: !!membership }
  })
}
