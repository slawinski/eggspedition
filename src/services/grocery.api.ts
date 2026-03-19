import { createServerFn } from '@tanstack/react-start'
import { setCookie } from '@tanstack/react-start/server'
import { protectedMiddleware } from '../lib/middleware'
import {
  getGroceryItems,
  getGroceryItemsGrouped,
  addGroceryItem,
  updateGroceryItem,
  deleteGroceryItem,
  getCategories,
  addCategory,
  getStores,
  addStore,
  getHouseholdLogs,
  joinHousehold,
} from './grocery.service'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'
import { signalEmitter } from '../lib/signals'
import { signSession } from '../lib/auth-utils'

export const getGroceryItemsFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    return await getGroceryItems(context.session.householdId)
  })

export const getGroceryItemsGroupedFn = createServerFn({ method: 'GET' })
  .inputValidator(zodValidator(z.enum(['category', 'store'])))
  .middleware([protectedMiddleware])
  .handler(async ({ data, context }) => {
    return await getGroceryItemsGrouped(context.session.householdId, data)
  })

export const addGroceryItemFn = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        name: z.string().min(1),
        quantity: z.string().optional(),
        categoryId: z.string().uuid().optional(),
        storeId: z.string().uuid().optional(),
      })
    )
  )
  .middleware([protectedMiddleware])
  .handler(async ({ data, context }) => {
    return await addGroceryItem(context.session.householdId, context.session.userId, data)
  })

export const updateGroceryItemFn = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          name: z.string().min(1).optional(),
          quantity: z.string().optional(),
          categoryId: z.string().uuid().optional().nullable(),
          storeId: z.string().uuid().optional().nullable(),
          checked: z.enum(['true', 'false']).optional(),
        }),
      })
    )
  )
  .middleware([protectedMiddleware])
  .handler(async ({ data, context }) => {
    return await updateGroceryItem(data.id, context.session.userId, data.data)
  })

export const deleteGroceryItemFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string().uuid()))
  .middleware([protectedMiddleware])
  .handler(async ({ data: id, context }) => {
    return await deleteGroceryItem(id, context.session.userId)
  })

export const getCategoriesFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    return await getCategories(context.session.householdId)
  })

export const addCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string().min(1)))
  .middleware([protectedMiddleware])
  .handler(async ({ data: name, context }) => {
    return await addCategory(context.session.householdId, name)
  })

export const getStoresFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    return await getStores(context.session.householdId)
  })

export const addStoreFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string().min(1)))
  .middleware([protectedMiddleware])
  .handler(async ({ data: name, context }) => {
    return await addStore(context.session.householdId, name)
  })

export const getHouseholdLogsFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    return await getHouseholdLogs(context.session.householdId)
  })

export const joinHouseholdFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string().uuid()))
  .middleware([protectedMiddleware])
  .handler(async ({ data: householdId, context }) => {
    const result = await joinHousehold(context.session.userId, householdId)
    
    // Update the session cookie with the new householdId
    const newToken = await signSession({
      ...context.session,
      householdId: result,
    })

    setCookie('session_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    return result
  })

export const householdSignalFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const householdId = context.session.householdId

    const stream = new ReadableStream({
      start(controller) {
        console.log(`[SSE] Connection opened for household: ${householdId}`)
        const handler = (data: { householdId: string; action: string }) => {
          if (data.householdId === householdId) {
            console.log(`[SSE] Enqueuing signal: ${data.action}`)
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
          }
        }

        signalEmitter.on('household-signal', handler)

        const keepAlive = setInterval(() => {
          try {
            console.log(`[SSE] Sending keep-alive for ${householdId}`)
            controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'))
          } catch (err) {
            console.log(`[SSE] Connection closed for ${householdId}`)
            clearInterval(keepAlive)
            signalEmitter.off('household-signal', handler)
          }
        }, 30000)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  })
