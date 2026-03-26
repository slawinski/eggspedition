import { db } from '../db'
import { users, groceryItems, categories, stores, householdLogs, households, memberships, quickAddItems } from '../db/schema'
import { eq, desc, and, count } from 'drizzle-orm'
import type { GroceryItem, Category, Store } from '../lib/schemas'
import { insertGroceryItemSchema, insertCategorySchema, insertStoreSchema, insertQuickAddItemSchema } from '../lib/schemas'
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

  // Create default household
  const [newHousehold] = await db
    .insert(households)
    .values({ name: 'My Household' })
    .returning()

  if (!newHousehold) {
    throw new Error('Failed to create default household')
  }

  await db.insert(memberships).values({
    userId,
    householdId: newHousehold.id,
    role: 'admin',
  })

  return newHousehold.id
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
  input: { name: string; quantity?: string; categoryId?: string; storeId?: string; categoryName?: string | null; storeName?: string | null }
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
    // Increment quantity
    const currentQty = parseInt(existing.quantity) || 1
    const newQty = (currentQty + (parseInt(input.quantity || '1') || 1)).toString()
    
    const [updated] = await db
      .update(groceryItems)
      .set({ 
        quantity: newQty,
        ...(resolvedCategoryId && { categoryId: resolvedCategoryId }),
        ...(resolvedStoreId && { storeId: resolvedStoreId }),
        updatedAt: new Date()
      })
      .where(eq(groceryItems.id, existing.id))
      .returning()

    await db.insert(householdLogs).values({
      householdId,
      userId,
      action: 'update',
      itemName: updated.name,
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

  // Auto-populate Quick Add templates if it doesn't exist for this household
  const [existingTemplate] = await db
    .select()
    .from(quickAddItems)
    .where(
      and(
        eq(quickAddItems.name, input.name),
        eq(quickAddItems.householdId, householdId)
      )
    )
    .limit(1)

  if (!existingTemplate) {
    await db.insert(quickAddItems).values({
      name: input.name,
      categoryId: resolvedCategoryId,
      storeId: resolvedStoreId,
      householdId: householdId,
    })
    console.log(`[Service] Auto-created template for: ${input.name}`)
    await notifyHousehold(householdId, 'quick-add-update')
  }

  await db.insert(householdLogs).values({
    householdId,
    userId,
    action: 'add',
    itemName: item.name,
  })

  console.log(`[Service] Item added, notifying household: ${householdId}`)
  await notifyHousehold(householdId, 'add')

  return item
}

export async function updateGroceryItem(
  itemId: string,
  userId: string,
  input: Partial<Omit<GroceryItem, 'id' | 'householdId' | 'userId' | 'createdAt'>>
) {
  const [existing] = await db.select().from(groceryItems).where(eq(groceryItems.id, itemId)).limit(1)
  if (!existing) throw new Error('Item not found')

  const [updated] = await db
    .update(groceryItems)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(groceryItems.id, itemId))
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
  })

  console.log(`[Service] Item updated, notifying household: ${existing.householdId}`)
  await notifyHousehold(existing.householdId, action)

  return updated
}

export async function deleteGroceryItem(itemId: string, userId: string) {
  const [existing] = await db.select().from(groceryItems).where(eq(groceryItems.id, itemId)).limit(1)
  if (!existing) throw new Error('Item not found')

  await db.delete(groceryItems).where(eq(groceryItems.id, itemId))

  await db.insert(householdLogs).values({
    householdId: existing.householdId,
    userId,
    action: 'remove',
    itemName: existing.name,
  })

  console.log(`[Service] Item removed, notifying household: ${existing.householdId}`)
  notifyHousehold(existing.householdId, 'remove')
}

export async function getCategories(householdId: string) {
  return await db.select().from(categories).where(eq(categories.householdId, householdId))
}

export async function addCategory(householdId: string, name: string) {
  const data = insertCategorySchema.parse({ name, householdId })
  const [category] = await db.insert(categories).values(data).returning()
  return category
}

export async function getStores(householdId: string) {
  return await db.select().from(stores).where(eq(stores.householdId, householdId))
}

export async function addStore(householdId: string, name: string) {
  const data = insertStoreSchema.parse({ name, householdId })
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

export async function getFrequentItems(householdId: string) {
  const results = await db
    .select({
      name: householdLogs.itemName,
      count: count(householdLogs.id),
    })
    .from(householdLogs)
    .where(and(eq(householdLogs.householdId, householdId), eq(householdLogs.action, 'add')))
    .groupBy(householdLogs.itemName)
    .orderBy(desc(count(householdLogs.id)))
    .limit(12)

  return results
}

export async function getQuickAddItems(householdId: string) {
  console.log(`[Service] Fetching quick add items for household: ${householdId}`)
  const results = await db
    .select()
    .from(quickAddItems)
    .where(eq(quickAddItems.householdId, householdId))
    .orderBy(desc(quickAddItems.createdAt))
  console.log(`[Service] Found ${results.length} quick add items`)
  return results
}

async function resolveCategoryId(householdId: string, name?: string | null) {
  if (!name?.trim()) return null
  const trimmedName = name.trim()
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
  const trimmedName = name.trim()
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

export async function addQuickAddItem(householdId: string, input: { name: string; categoryName?: string | null; storeName?: string | null }) {
  const categoryId = await resolveCategoryId(householdId, input.categoryName)
  const storeId = await resolveStoreId(householdId, input.storeName)
  
  const data = insertQuickAddItemSchema.parse({ 
    name: input.name,
    categoryId,
    storeId,
    householdId 
  })
  
  const [item] = await db.insert(quickAddItems).values(data).returning()
  await notifyHousehold(householdId, 'quick-add-update')
  return item
}

export async function updateQuickAddItem(id: string, input: { name?: string; categoryName?: string | null; storeName?: string | null }) {
  const [existing] = await db.select().from(quickAddItems).where(eq(quickAddItems.id, id)).limit(1)
  if (!existing) throw new Error('Item not found')

  const categoryId = input.categoryName !== undefined ? await resolveCategoryId(existing.householdId, input.categoryName) : undefined
  const storeId = input.storeName !== undefined ? await resolveStoreId(existing.householdId, input.storeName) : undefined

  const [updated] = await db
    .update(quickAddItems)
    .set({
      name: input.name,
      ...(categoryId !== undefined && { categoryId }),
      ...(storeId !== undefined && { storeId }),
    })
    .where(eq(quickAddItems.id, id))
    .returning()

  // Propagate changes to existing grocery items with the same name in this household
  // We match by the OLD name to find items that need updating
  await db
    .update(groceryItems)
    .set({
      ...(input.name && { name: input.name }),
      ...(categoryId !== undefined && { categoryId }),
      ...(storeId !== undefined && { storeId }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(groceryItems.name, existing.name),
        eq(groceryItems.householdId, existing.householdId),
        eq(groceryItems.checked, 'false') // Usually only update items not yet purchased
      )
    )
  
  console.log(`[Service] Propagated template changes to grocery items for: ${existing.name}`)
  await notifyHousehold(existing.householdId, 'quick-add-update')
  await notifyHousehold(existing.householdId, 'update') // Notify list view to refresh
  
  return updated
}

export async function deleteQuickAddItem(id: string) {
  const [existing] = await db.select().from(quickAddItems).where(eq(quickAddItems.id, id)).limit(1)
  if (!existing) return

  await db.delete(quickAddItems).where(eq(quickAddItems.id, id))
  await notifyHousehold(existing.householdId, 'quick-add-update')
}
