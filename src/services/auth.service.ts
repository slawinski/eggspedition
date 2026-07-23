import { createTransport } from 'nodemailer'
import { db } from '../db'
import { users, magicLinks, memberships } from '../db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { generateToken, signSession } from '../lib/auth-utils'
import { loginSchema } from '../lib/schemas'
import { getOrCreateDefaultHousehold } from './grocery.service'

const transporter = createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
})

export async function sendMagicLink(emailInput: string, returnTo?: string, extraParams?: Record<string, any>) {
  // 1. Validate input
  const { email } = loginSchema.parse({ email: emailInput })

  // 2. Generate token and save to DB
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes expiry

  await db.insert(magicLinks).values({
    email,
    token,
    expiresAt,
  })

  // 3. Build magic link URL
  let magicLink = `${process.env.BASE_URL}/api/auth/verify?token=${token}`

  if (returnTo) {
    magicLink += `&returnTo=${encodeURIComponent(returnTo)}`
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value) magicLink += `&${key}=${encodeURIComponent(value)}`
      })
    }
  }

  // 4. Send email via Gmail SMTP
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Eggspedition <noreply@example.com>',
    to: email,
    subject: 'Your Magic Link for Eggspedition',
    html: `<p>Click the link below to sign in to your Eggspedition:</p><a href="${magicLink}">${magicLink}</a><p>This link expires in 15 minutes.</p>`,
  })
}

export async function verifyMagicLink(token: string) {
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

  const householdId = membership ? membership.householdId : await getOrCreateDefaultHousehold(user.id)

  // 5. Generate long-lived session JWT
  return await signSession({
    userId: user.id,
    email: user.email,
    householdId,
  })
}
