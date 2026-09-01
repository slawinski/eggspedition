import { db } from '../db'
import { users, groceryItems, categories, stores, householdLogs, memberships } from '../db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import type { GroceryItem, Category, Store } from '../lib/schemas'
import { insertGroceryItemSchema, insertCategorySchema, insertStoreSchema } from '../lib/schemas'
import { notifyHousehold } from '../lib/signals'

export async function getOrCreateDefaultHousehold(userId: string) {
  const [existingMembership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1)

  if (existingMembership) {
    return existingMembership.householdId
  }

  // No longer auto-create — returns null so callers can trigger onboarding
  return null
}

export async function getGroceryItems(householdId: string) {
  return await db
    .select()
    .from(groceryItems)
    .where(eq(groceryItems.householdId, householdId))
    .orderBy(desc(groceryItems.createdAt))
}

export async function getGroceryItemsGrouped(householdId: string, groupBy: 'category' | 'store') {
  const items = await getGroceryItems(householdId)
  
  if (groupBy === 'category') {
    const cats = await getCategories(householdId)
    const grouped: Record<string, { category: Category | null; items: GroceryItem[] }> = {
      unassigned: { category: null, items: [] },
    }
    
    cats.forEach(c => { grouped[c.id] = { category: c, items: [] } })
    items.forEach(i => {
      const key = i.categoryId || 'unassigned'
      if (grouped[key]) grouped[key].items.push(i)
      else grouped.unassigned.items.push(i)
    })
    return grouped
  } else {
    const strs = await getStores(householdId)
    const grouped: Record<string, { store: Store | null; items: GroceryItem[] }> = {
      unassigned: { store: null, items: [] },
    }
    
    strs.forEach(s => { grouped[s.id] = { store: s, items: [] } })
    items.forEach(i => {
      const key = i.storeId || 'unassigned'
      if (grouped[key]) grouped[key].items.push(i)
      else grouped.unassigned.items.push(i)
    })
    return grouped
  }
}

export async function addGroceryItem(
  householdId: string,
  userId: string,
  input: { name: string; quantity?: string; categoryId?: string; storeId?: string; categoryName?: string | null; storeName?: string | null; operationId?: string }
) {
  // Resolve names to IDs if provided
  const resolvedCategoryId = input.categoryId || (input.categoryName ? await resolveCategoryId(householdId, input.categoryName) : undefined)
  const resolvedStoreId = input.storeId || (input.storeName ? await resolveStoreId(householdId, input.storeName) : undefined)

  // Check if an unchecked item with the same name already exists in this household
  const [existing] = await db
    .select()
    .from(groceryItems)
    .where(
      and(
        eq(groceryItems.name, input.name),
        eq(groceryItems.householdId, householdId),
        eq(groceryItems.checked, 'false')
      )
    )
    .limit(1)

  if (existing) {
    // Atomic SQL increment — avoids read-modify-write race
    const delta = parseInt(input.quantity || '1') || 1

    const [updated] = await db
      .update(groceryItems)
      .set({
        quantity: sql`${groceryItems.quantity} + ${delta}`,
        ...(resolvedCategoryId && { categoryId: resolvedCategoryId }),
        ...(resolvedStoreId && { storeId: resolvedStoreId }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(groceryItems.id, existing.id),
          eq(groceryItems.householdId, householdId),
        ),
      )
      .returning()

    await db.insert(householdLogs).values({
      householdId,
      userId,
      action: 'update',
      itemName: updated.name,
      categoryId: updated.categoryId ?? null,
      storeId: updated.storeId ?? null,
    })

    console.log(`[Service] Item quantity incremented, notifying household: ${householdId}`)
    await notifyHousehold(householdId, 'update')

    return updated
  }

  // Otherwise, create new item
  const data = insertGroceryItemSchema.parse({
    name: input.name,
    quantity: input.quantity,
    categoryId: resolvedCategoryId,
    storeId: resolvedStoreId,
    householdId,
    userId,
  })

  const [item] = await db.insert(groceryItems).values(data).returning()

  await db.insert(householdLogs).values({
    householdId,
    userId,
    action: 'add',
    itemName: item.name,
    categoryId: item.categoryId ?? null,
    storeId: item.storeId ?? null,
  })

  console.log(`[Service] Item added, notifying household: ${householdId}`)
  await notifyHousehold(householdId, 'add')

  return item
}

export async function updateGroceryItem(
  itemId: string,
  householdId: string,
  userId: string,
  input: Partial<Omit<GroceryItem, 'id' | 'householdId' | 'userId' | 'createdAt'>>,
) {
  const [existing] = await db
    .select()
    .from(groceryItems)
    .where(
      and(
        eq(groceryItems.id, itemId),
        eq(groceryItems.householdId, householdId),
      ),
    )
    .limit(1)
  if (!existing) throw new Error('Item not found')

  const [updated] = await db
    .update(groceryItems)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(
        eq(groceryItems.id, itemId),
        eq(groceryItems.householdId, householdId),
      ),
    )
    .returning()

  let action = 'update'
  if (input.checked !== undefined) {
    action = input.checked === 'true' ? 'check' : 'uncheck'
  }

  await db.insert(householdLogs).values({
    householdId: existing.householdId,
    userId,
    action,
    itemName: updated.name,
    categoryId: updated.categoryId ?? null,
    storeId: updated.storeId ?? null,
  })

  console.log(`[Service] Item updated, notifying household: ${existing.householdId}`)
  await notifyHousehold(existing.householdId, action)

  return updated
}

export async function deleteGroceryItem(itemId: string, householdId: string, userId: string) {
  const [existing] = await db
    .select()
    .from(groceryItems)
    .where(
      and(
        eq(groceryItems.id, itemId),
        eq(groceryItems.householdId, householdId),
      ),
    )
    .limit(1)
  if (!existing) throw new Error('Item not found')

  await db
    .delete(groceryItems)
    .where(
      and(
        eq(groceryItems.id, itemId),
        eq(groceryItems.householdId, householdId),
      ),
    )

  await db.insert(householdLogs).values({
    householdId: existing.householdId,
    userId,
    action: 'remove',
    itemName: existing.name,
    categoryId: existing.categoryId ?? null,
    storeId: existing.storeId ?? null,
  })

  console.log(`[Service] Item removed, notifying household: ${existing.householdId}`)
  notifyHousehold(existing.householdId, 'remove')
}

export async function getCategories(householdId: string) {
  return await db.select().from(categories).where(eq(categories.householdId, householdId))
}

export async function addCategory(householdId: string, name: string) {
  const data = insertCategorySchema.parse({ name: name.toLowerCase(), householdId })
  const [category] = await db.insert(categories).values(data).returning()
  return category
}

export async function getStores(householdId: string) {
  return await db.select().from(stores).where(eq(stores.householdId, householdId))
}

export async function addStore(householdId: string, name: string) {
  const data = insertStoreSchema.parse({ name: name.toLowerCase(), householdId })
  const [store] = await db.insert(stores).values(data).returning()
  return store
}

export async function joinHousehold(userId: string, householdId: string) {
  const [existing] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.householdId, householdId)))
    .limit(1)

  if (existing) return householdId

  await db.insert(memberships).values({
    userId,
    householdId,
    role: 'member',
  })

  return householdId
}

export async function getHouseholdLogs(householdId: string) {
  const logs = await db
    .select({
      id: householdLogs.id,
      action: householdLogs.action,
      itemName: householdLogs.itemName,
      categoryId: householdLogs.categoryId,
      storeId: householdLogs.storeId,
      timestamp: householdLogs.timestamp,
      userName: users.name,
      userEmail: users.email,
    })
    .from(householdLogs)
    .leftJoin(users, eq(householdLogs.userId, users.id))
    .where(eq(householdLogs.householdId, householdId))
    .orderBy(desc(householdLogs.timestamp))
    .limit(50)

  // Ensure dates are serialized as strings for TanStack Start compatibility
  return logs.map(log => ({
    ...log,
    timestamp: log.timestamp.toISOString(),
  }))
}

async function resolveCategoryId(householdId: string, name?: string | null) {
  if (!name?.trim()) return null
  const trimmedName = name.trim().toLowerCase()
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.name, trimmedName), eq(categories.householdId, householdId)))
    .limit(1)
  
  if (existing) return existing.id
  
  const [newCat] = await db
    .insert(categories)
    .values({ name: trimmedName, householdId })
    .returning()
  return newCat.id
}

async function resolveStoreId(householdId: string, name?: string | null) {
  if (!name?.trim()) return null
  const trimmedName = name.trim().toLowerCase()
  const [existing] = await db
    .select()
    .from(stores)
    .where(and(eq(stores.name, trimmedName), eq(stores.householdId, householdId)))
    .limit(1)
  
  if (existing) return existing.id
  
  const [newStore] = await db
    .insert(stores)
    .values({ name: trimmedName, householdId })
    .returning()
  return newStore.id
}
