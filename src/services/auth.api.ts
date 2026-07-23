import { createServerFn } from '@tanstack/react-start'
import { setCookie, deleteCookie, getCookie } from '@tanstack/react-start/server'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'

export const getSessionServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const token = getCookie('session_token')
  if (!token) return null
  const { verifySession } = await import('../lib/auth-utils')
  return await verifySession(token)
})

export const loginServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        email: z.string().email(),
        returnTo: z.string().optional(),
        name: z.string().optional(),
        quantity: z.string().optional(),
      })
    )
  )
  .handler(async ({ data }) => {
    const { sendMagicLink } = await import('./auth.service')
    await sendMagicLink(data.email, data.returnTo, { name: data.name, quantity: data.quantity })
    return { success: true }
  })

export const logoutServerFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    deleteCookie('session_token')
    return { success: true }
  })

export const verifyMagicLinkServerFn = createServerFn({ method: 'GET' })
  .inputValidator(zodValidator(z.string()))
  .handler(async ({ data: token }) => {
    const { verifyMagicLink } = await import('./auth.service')
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
