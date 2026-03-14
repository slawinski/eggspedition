import { createServerFn } from '@tanstack/react-start'
import { setCookie, deleteCookie } from 'vinxi/http'
import { sendMagicLink, verifyMagicLink } from './auth.service'
import { loginSchema } from '../lib/schemas'

export const loginServerFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; returnTo?: string; name?: string; quantity?: string }) => data)
  .handler(async ({ data }) => {
    // Generate the return URL to be included in the magic link if necessary
    // However, the current auth service doesn't support custom magic link URLs easily per request
    // Let's modify auth.service.ts to accept a custom redirect path
    await sendMagicLink(data.email, data.returnTo, { name: data.name, quantity: data.quantity })
    return { success: true }
  })

export const logoutServerFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    deleteCookie('session_token')
    return { success: true }
  })

export const verifyMagicLinkServerFn = createServerFn({ method: 'GET' })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const sessionToken = await verifyMagicLink(token)
    
    if (sessionToken) {
      setCookie('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days sticky sessions
      })
      return { success: true }
    }
    
    return { success: false }
  })
