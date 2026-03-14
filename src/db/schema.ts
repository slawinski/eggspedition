import { pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const memberships = pgTable('memberships', {
  userId: uuid('user_id').notNull().references(() => users.id),
  householdId: uuid('household_id').notNull().references(() => households.id),
  role: text('role').notNull().default('member'), // 'admin' or 'member'
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (t) => ({
  unq: uniqueIndex('membership_unique').on(t.userId, t.householdId),
}))

export const magicLinks = pgTable('magic_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  householdId: uuid('household_id').notNull().references(() => households.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  householdId: uuid('household_id').notNull().references(() => households.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const groceryItems = pgTable('grocery_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  quantity: text('quantity').notNull().default('1'),
  categoryId: uuid('category_id').references(() => categories.id),
  storeId: uuid('store_id').references(() => stores.id),
  householdId: uuid('household_id').notNull().references(() => households.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  checked: text('checked').notNull().default('false'), // Using text for boolean-ish behavior if preferred, but boolean is better in PG. SPEC says "checked/unchecked"
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const householdLogs = pgTable('household_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: text('action').notNull(), // 'add', 'remove', 'check', 'uncheck'
  itemName: text('item_name').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
})
