import { createServerFn } from '@tanstack/react-start'
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
} from './grocery.service'
import { z } from 'zod'
import { signalEmitter } from '../lib/signals'

export const getGroceryItemsFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    return await getGroceryItems(context.session.householdId)
  })

export const getGroceryItemsGroupedFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .validator(z.enum(['category', 'store']))
  .handler(async ({ data, context }) => {
    return await getGroceryItemsGrouped(context.session.householdId, data)
  })

export const addGroceryItemFn = createServerFn({ method: 'POST' })
  .middleware([protectedMiddleware])
  .validator(
    z.object({
      name: z.string().min(1),
      quantity: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      storeId: z.string().uuid().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    return await addGroceryItem(context.session.householdId, context.session.userId, data)
  })

export const updateGroceryItemFn = createServerFn({ method: 'PATCH' })
  .middleware([protectedMiddleware])
  .validator(
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
  .handler(async ({ data, context }) => {
    return await updateGroceryItem(data.id, context.session.userId, data.data)
  })

export const deleteGroceryItemFn = createServerFn({ method: 'POST' })
  .middleware([protectedMiddleware])
  .validator(z.string().uuid())
  .handler(async ({ data: id, context }) => {
    return await deleteGroceryItem(id, context.session.userId)
  })

export const getCategoriesFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    return await getCategories(context.session.householdId)
  })

export const addCategoryFn = createServerFn({ method: 'POST' })
  .middleware([protectedMiddleware])
  .validator(z.string().min(1))
  .handler(async ({ data: name, context }) => {
    return await addCategory(context.session.householdId, name)
  })

export const getStoresFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    return await getStores(context.session.householdId)
  })

export const addStoreFn = createServerFn({ method: 'POST' })
  .middleware([protectedMiddleware])
  .validator(z.string().min(1))
  .handler(async ({ data: name, context }) => {
    return await addStore(context.session.householdId, name)
  })

export const getHouseholdLogsFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    return await getHouseholdLogs(context.session.householdId)
  })

export const householdSignalFn = createServerFn({ method: 'GET' })
  .middleware([protectedMiddleware])
  .handler(async ({ context }) => {
    const householdId = context.session.householdId

    const stream = new ReadableStream({
      start(controller) {
        const handler = (data: { householdId: string; action: string }) => {
          if (data.householdId === householdId) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
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
