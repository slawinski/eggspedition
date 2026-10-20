import { pgTable, text, timestamp, uuid, uniqueIndex, integer, jsonb, bigint, boolean } from 'drizzle-orm/pg-core'

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

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  authenticatedAt: timestamp('authenticated_at').notNull(),
  lastActivityAt: timestamp('last_activity_at').notNull(),
  inactivityExpiresAt: timestamp('inactivity_expires_at').notNull(),
  absoluteExpiresAt: timestamp('absolute_expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  // Keep adoption tombstones: an old cookie must never recreate a revoked session.
  legacyTokenDigest: text('legacy_token_digest').unique(),
  legacyExpiresAt: timestamp('legacy_expires_at'),
})

// One lockable row per normalized email, including before its first account exists.
export const emailCodes = pgTable('email_codes', {
  email: text('email').primaryKey(),
  generation: uuid('generation').unique(),
  codeDigest: text('code_digest'),
  bindingDigest: text('binding_digest'),
  expiresAt: timestamp('expires_at'),
  consumedAt: timestamp('consumed_at'),
  attempts: integer('attempts').notNull().default(0),
  issuedAt: jsonb('issued_at').$type<number[]>().notNull().default([]),
})

export const passkeys = pgTable('passkeys', {
  credentialId: text('credential_id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  publicKey: text('public_key').notNull(), // base64url COSE key
  counter: bigint('counter', { mode: 'number' }).notNull(),
  transports: jsonb('transports').$type<string[]>().notNull().default([]),
  deviceType: text('device_type').notNull(),
  backedUp: boolean('backed_up').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
})

export const webauthnChallenges = pgTable('webauthn_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  challenge: text('challenge').notNull(),
  purpose: text('purpose').$type<'registration' | 'authentication'>().notNull(),
  expectedOrigin: text('expected_origin').notNull(),
  rpID: text('rp_id').notNull(),
  userId: uuid('user_id').references(() => users.id),
  sessionId: uuid('session_id').references(() => authSessions.id),
  bindingDigest: text('binding_digest').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
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
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const householdLogs = pgTable('household_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: text('action').notNull(), // 'add', 'remove', 'check', 'uncheck'
  itemName: text('item_name').notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  storeId: uuid('store_id').references(() => stores.id),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
})

export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id),
  token: text('token').notNull().unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  redeemedBy: uuid('redeemed_by').references(() => users.id),
  expiresAt: timestamp('expires_at'),
  redeemedAt: timestamp('redeemed_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const appliedOperations = pgTable('applied_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  operationId: text('operation_id').notNull().unique(),
  householdId: uuid('household_id').notNull(),
  operationType: text('operation_type').notNull(),
  entityId: uuid('entity_id'),
  result: text('result'), // JSON string
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
