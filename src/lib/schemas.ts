import { createSelectSchema, createInsertSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users, households, memberships, categories, stores, groceryItems, householdLogs, quickAddItems } from '../db/schema'

export { users, households, memberships, categories, stores, groceryItems, householdLogs, quickAddItems }

export const userSchema = createSelectSchema(users)
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
})

export const householdSchema = createSelectSchema(households)
export const insertHouseholdSchema = createInsertSchema(households)

export const membershipSchema = createSelectSchema(memberships)

export const categorySchema = createSelectSchema(categories)
export const insertCategorySchema = createInsertSchema(categories)

export const storeSchema = createSelectSchema(stores)
export const insertStoreSchema = createInsertSchema(stores)

export const groceryItemSchema = createSelectSchema(groceryItems)
export const insertGroceryItemSchema = createInsertSchema(groceryItems)

export const quickAddItemSchema = createSelectSchema(quickAddItems)
export const insertQuickAddItemSchema = createInsertSchema(quickAddItems)

export const householdLogSchema = createSelectSchema(householdLogs)

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

export const sessionSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  householdId: z.string().uuid().optional(),
})

export type User = z.infer<typeof userSchema>
export type Session = z.infer<typeof sessionSchema>
export type Category = z.infer<typeof categorySchema>
export type Store = z.infer<typeof storeSchema>
export type GroceryItem = z.infer<typeof groceryItemSchema>
export type QuickAddItem = z.infer<typeof quickAddItemSchema>
export type HouseholdLog = z.infer<typeof householdLogSchema>

