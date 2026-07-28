import { createTransport, type Transporter } from 'nodemailer'
import { db } from '../db'
import { users, magicLinks, memberships } from '../db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { generateToken, signSession } from '../lib/auth-utils'
import { loginSchema } from '../lib/schemas'

let _transporter: Transporter | null = null

// ─── Rate Limiting ────────────────────────────────────────
const RATE_LIMIT_MAX_ATTEMPTS = 3
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute

const rateLimitMap = new Map<string, { attempts: number; resetAt: number }>()

function checkRateLimit(email: string): { allowed: boolean; secondsRemaining: number } {
  const now = Date.now()
  const key = email.toLowerCase()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { attempts: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, secondsRemaining: 0 }
  }

  if (record.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    const secondsRemaining = Math.ceil((record.resetAt - now) / 1000)
    return { allowed: false, secondsRemaining }
  }

  record.attempts++
  return { allowed: true, secondsRemaining: 0 }
}

// ─── Error code helpers ───────────────────────────────────
// Prefixed error messages allow the client to parse structured
// error info from serialized Error objects crossing the RPC boundary.
function rateLimitError(secondsRemaining: number): Error {
  return new Error(
    `[RATE_LIMIT:${secondsRemaining}] Too many attempts. Try again in ${secondsRemaining} seconds.`
  )
}

function whitelistError(): Error {
  return new Error('[WHITELIST] This email is not authorized to access Eggspedition.')
}

function validationError(): Error {
  return new Error('[VALIDATION] Please enter a valid email address.')
}

function deliveryError(): Error {
  return new Error(
    "[DELIVERY_FAILURE] We couldn't send the email. Check your connection and try again."
  )
}

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

function isWhitelisted(email: string): boolean {
  const raw = process.env.AUTH_WHITELIST || ''
  const allowed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  return allowed.includes(email.toLowerCase())
}

export async function sendMagicLink(
  emailInput: string,
  returnTo?: string,
  extraParams?: Record<string, any>
) {
  // 1. Validate input
  let email: string
  try {
    const parsed = loginSchema.parse({ email: emailInput })
    email = parsed.email
  } catch {
    throw validationError()
  }

  // 2. Rate limit check — must happen before whitelist to prevent enumeration
  const { allowed, secondsRemaining } = checkRateLimit(email)
  if (!allowed) {
    throw rateLimitError(secondsRemaining)
  }

  // 3. Whitelist check — block non-whitelisted emails immediately
  if (!isWhitelisted(email)) {
    throw whitelistError()
  }

  // 4. Generate token and save to DB
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes expiry

  await db.insert(magicLinks).values({
    email,
    token,
    expiresAt,
  })

  // 5. Build magic link URL — always include deep-link params
  let magicLink = `${process.env.BASE_URL}/api/auth/verify?token=${encodeURIComponent(token)}`

  if (returnTo) {
    magicLink += `&returnTo=${encodeURIComponent(returnTo)}`
  }

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined && value !== '') {
        magicLink += `&${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
      }
    }
  }

  // 6. Send email via Gmail SMTP
  try {
    const transporter = getTransporter()
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Eggspedition <noreply@example.com>',
      to: email,
      subject: 'Your Magic Link for Eggspedition',
      html: `<p>Click the link below to sign in to your Eggspedition:</p><p><a href="${magicLink}">${magicLink}</a></p><p>This link expires in 15 minutes.</p>`,
    })
  } catch {
    throw deliveryError()
  }
}

export async function verifyMagicLink(
  token: string
): Promise<{ sessionToken: string; hasHousehold: boolean } | null> {
  // 1. Find and validate token in DB
  const [record] = await db
    .select()
    .from(magicLinks)
    .where(and(eq(magicLinks.token, token), gt(magicLinks.expiresAt, new Date())))
    .limit(1)

  if (!record) return null

  // 2. Find or create user
  let [user] = await db.select().from(users).where(eq(users.email, record.email)).limit(1)

  if (!user) {
    ;[user] = await db.insert(users).values({ email: record.email }).returning()
  }

  // 3. Delete used token
  await db.delete(magicLinks).where(eq(magicLinks.token, token))

  // 4. Get household membership (most recent first)
  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .orderBy(desc(memberships.joinedAt))
    .limit(1)

  const hasHousehold = !!membership

  // 5. Generate long-lived session JWT
  const sessionToken = await signSession({
    userId: user.id,
    email: user.email,
    householdId: membership ? membership.householdId : undefined,
  })

  return { sessionToken, hasHousehold }
}
