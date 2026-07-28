import { createServerFn } from '@tanstack/react-start'
import { protectedMiddleware } from '../lib/middleware'
import { z } from 'zod'
import { zodValidator } from '@tanstack/zod-adapter'

export const getGroceryItemsFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { getGroceryItems } = await import('./grocery.service')
    const items = await getGroceryItems(context.session.householdId)
    console.log(`[API] getGroceryItems for ${context.session.householdId} returned ${items.length} items`)
    return items
  })

export const getGroceryItemsGroupedFn = createServerFn({ method: 'GET' })
  .inputValidator(zodValidator(z.enum(['category', 'store'])))
  .middleware([protectedMiddleware])
  .handler(async ({ data, context }) => {
    const { getGroceryItemsGrouped } = await import('./grocery.service')
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
        categoryName: z.string().optional().nullable(),
        storeName: z.string().optional().nullable(),
        operationId: z.string().optional(),
      })
    )
  )
  .middleware([protectedMiddleware])
  .handler(async ({ data, context }) => {
    console.log(`[API] addGroceryItem: ${data.name} for household: ${context.session.householdId}`)
    const { addGroceryItem } = await import('./grocery.service')
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
    const { updateGroceryItem } = await import('./grocery.service')
    return await updateGroceryItem(data.id, context.session.householdId, context.session.userId, data.data)
  })

export const deleteGroceryItemFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string().uuid()))
  .middleware([protectedMiddleware])
  .handler(async ({ data: id, context }) => {
    const { deleteGroceryItem } = await import('./grocery.service')
    return await deleteGroceryItem(id, context.session.householdId, context.session.userId)
  })

export const getCategoriesFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { getCategories } = await import('./grocery.service')
    return await getCategories(context.session.householdId)
  })

export const addCategoryFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string().min(1)))
  .middleware([protectedMiddleware])
  .handler(async ({ data: name, context }) => {
    const { addCategory } = await import('./grocery.service')
    return await addCategory(context.session.householdId, name)
  })

export const getStoresFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { getStores } = await import('./grocery.service')
    return await getStores(context.session.householdId)
  })

export const addStoreFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string().min(1)))
  .middleware([protectedMiddleware])
  .handler(async ({ data: name, context }) => {
    const { addStore } = await import('./grocery.service')
    return await addStore(context.session.householdId, name)
  })

export const getHouseholdLogsFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { getHouseholdLogs } = await import('./grocery.service')
    const logs = await getHouseholdLogs(context.session.householdId)
    console.log(`[API] getHouseholdLogs for ${context.session.householdId} returned ${logs.length} logs`)
    return logs
  })

export const getFrequentItemsFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { getFrequentItems } = await import('./grocery.service')
    return await getFrequentItems(context.session.householdId)
  })

export const getQuickAddItemsFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const { getQuickAddItems } = await import('./grocery.service')
    return await getQuickAddItems(context.session.householdId)
  })

export const addQuickAddItemFn = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        name: z.string().min(1),
        categoryName: z.string().optional().nullable(),
        storeName: z.string().optional().nullable(),
      })
    )
  )
  .middleware([protectedMiddleware])
  .handler(async ({ data, context }) => {
    const { addQuickAddItem } = await import('./grocery.service')
    return await addQuickAddItem(context.session.householdId, data)
  })

export const updateQuickAddItemFn = createServerFn({ method: 'POST' })
  .inputValidator(
    zodValidator(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          name: z.string().min(1).optional(),
          categoryName: z.string().optional().nullable(),
          storeName: z.string().optional().nullable(),
        }),
      })
    )
  )
  .middleware([protectedMiddleware])
  .handler(async ({ data, context }) => {
    const { updateQuickAddItem } = await import('./grocery.service')
    return await updateQuickAddItem(data.id, context.session.householdId, data.data)
  })

export const deleteQuickAddItemFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string().uuid()))
  .middleware([protectedMiddleware])
  .handler(async ({ data: id, context }) => {
    const { deleteQuickAddItem } = await import('./grocery.service')
    return await deleteQuickAddItem(id, context.session.householdId)
  })

export const joinHouseholdFn = createServerFn({ method: 'POST' })
  .inputValidator(zodValidator(z.string().uuid()))
  .middleware([protectedMiddleware])
  .handler(async ({ data: householdId, context }) => {
    const { joinHousehold } = await import('./grocery.service')
    const { signSession } = await import('../lib/auth-utils')
    const { setCookie } = await import('@tanstack/react-start/server')
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
    const { signalEmitter } = await import('../lib/signals')
    const householdId = context.session.householdId

    const stream = new ReadableStream({
      start(controller) {
        console.log(`[SSE] Connection opened for household: ${householdId}`)
        const handler = (data: { householdId: string; action: string }) => {
          if (data.householdId === householdId) {
            try {
              console.log(`[SSE] Enqueuing signal: ${data.action}`)
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
            } catch (err) {
              // Usually means controller is closed
              signalEmitter.off('household-signal', handler)
            }
          }
        }

        signalEmitter.on('household-signal', handler)

        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'))
          } catch (err) {
            clearInterval(keepAlive)
            signalEmitter.off('household-signal', handler)
          }
        }, 30000)
      },
      cancel() {
        console.log(`[SSE] Stream cancelled for ${householdId}`)
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
