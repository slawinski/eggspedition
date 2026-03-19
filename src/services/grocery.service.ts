import { db } from '../db'
import { users, groceryItems, categories, stores, householdLogs, households, memberships } from '../db/schema'
import { eq, desc, and } from 'drizzle-orm'
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
  input: { name: string; quantity?: string; categoryId?: string; storeId?: string }
) {
  const data = insertGroceryItemSchema.parse({
    ...input,
    householdId,
    userId,
  })

  const [item] = await db.insert(groceryItems).values(data).returning()

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
