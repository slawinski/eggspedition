import { Resend } from 'resend'
import { db } from '../db'
import { users, magicLinks } from '../db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { generateToken, signSession } from '../lib/auth-utils'
import { loginSchema } from '../lib/schemas'
import { getOrCreateDefaultHousehold } from './grocery.service'

const resend = new Resend(process.env.RESEND_API_KEY!)
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

  // 3. Send email via Resend
  let magicLink = `${process.env.BASE_URL}/api/auth/verify?token=${token}`

  if (returnTo) {
    magicLink += `&returnTo=${encodeURIComponent(returnTo)}`
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value) magicLink += `&${key}=${encodeURIComponent(value)}`
      })
    }
  }

  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_123') {
...

    console.log('--- [DEV MODE] Magic Link Generated ---')
    console.log(`URL: ${magicLink}`)
    console.log('---------------------------------------')
    return
  }

  await resend.emails.send({
    from: 'GroceryApp <onboarding@resend.dev>', // Replace with your domain later
    to: email,
    subject: 'Your Magic Link for GroceryApp',
    html: `<p>Click the link below to sign in to your GroceryApp:</p><a href="${magicLink}">${magicLink}</a>`,
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

  // 4. Get or create household
  const householdId = await getOrCreateDefaultHousehold(user.id)

  // 5. Generate long-lived session JWT
  return await signSession({
    userId: user.id,
    email: user.email,
    householdId,
  })
}
