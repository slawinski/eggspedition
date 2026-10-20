import { createSelectSchema, createInsertSchema } from 'drizzle-zod'
import { z } from 'zod'
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { users, households, memberships, categories, stores, groceryItems, householdLogs } from '../db/schema'

export { users, households, memberships, categories, stores, groceryItems, householdLogs }

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

export const householdLogSchema = createSelectSchema(householdLogs)

export const verifyEmailCodeSchema = z.object({
  requestId: z.string().uuid(),
  // Format errors are domain rejections too, so their attempt accounting commits.
  code: z.string().max(64),
})

export const requestEmailCodeResultSchema = z.discriminatedUnion('status', [
  // Absolute Unix milliseconds for UI countdowns; retryAfter below is seconds.
  z.object({ status: z.literal('sent'), requestId: z.string().uuid(), expiresAt: z.number(), resendAt: z.number() }),
  z.object({ status: z.literal('rate_limited'), retryAfter: z.number().int().positive() }),
  z.object({ status: z.literal('delivery_failed'), retryAfter: z.number().int().positive() }),
  z.object({ status: z.literal('admission_denied') }),
  z.object({ status: z.literal('invalid_input') }),
])

export const verifyEmailCodeResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('authenticated'), hasHousehold: z.boolean() }),
  z.object({ status: z.literal('invalid'), attemptsRemaining: z.number().int().nonnegative().optional() }),
  z.object({ status: z.literal('expired') }),
  z.object({ status: z.literal('consumed') }),
  z.object({ status: z.literal('attempt_limit') }),
  z.object({ status: z.literal('admission_denied') }),
  z.object({ status: z.literal('ambiguous_identity') }),
])

export type RequestEmailCodeResult = z.infer<typeof requestEmailCodeResultSchema>
export type VerifyEmailCodeResult = z.infer<typeof verifyEmailCodeResultSchema>

const base64url = z.string().min(1).regex(/^[A-Za-z0-9_-]+$/)
const publicCredential = z.object({
  id: base64url, rawId: base64url, type: z.literal('public-key'),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.object({ credProps: z.object({ rk: z.boolean().optional() }).optional() }),
})
export const finishPasskeyRegistrationSchema = z.object({
  requestId: z.string().uuid(),
  response: publicCredential.extend({ response: z.object({
    clientDataJSON: base64url, attestationObject: base64url,
    transports: z.array(z.string()).optional(),
    publicKeyAlgorithm: z.number().optional(), publicKey: base64url.optional(), authenticatorData: base64url.optional(),
  }) }),
})
export const finishPasskeyAuthenticationSchema = z.object({
  requestId: z.string().uuid(),
  response: publicCredential.extend({ response: z.object({
    clientDataJSON: base64url, authenticatorData: base64url, signature: base64url, userHandle: base64url.optional(),
  }) }),
})
export const passkeyFinishResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('registered') }),
  z.object({ status: z.literal('authenticated'), hasHousehold: z.boolean() }),
  z.object({ status: z.literal('invalid') }),
  z.object({ status: z.literal('unauthenticated') }),
  z.object({ status: z.literal('duplicate') }),
  z.object({ status: z.literal('admission_denied') }),
])
export type PasskeyFinishResult = z.infer<typeof passkeyFinishResultSchema>
export type FinishPasskeyRegistrationInput = z.infer<typeof finishPasskeyRegistrationSchema>
export type FinishPasskeyAuthenticationInput = z.infer<typeof finishPasskeyAuthenticationSchema>
export type PasskeyRegistrationOptionsResult = {
  status: 'options'; requestId: string
  optionsJSON: Omit<PublicKeyCredentialCreationOptionsJSON, 'extensions'> & { extensions: { credProps: boolean } }
}
export type PasskeyAuthenticationOptionsResult = {
  status: 'options'; requestId: string
  optionsJSON: Omit<PublicKeyCredentialRequestOptionsJSON, 'extensions'>
}

export const sessionIdentitySchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  householdId: z.string().uuid().optional(),
})

export const sessionSchema = sessionIdentitySchema.extend({
  sessionId: z.string().uuid(),
  authenticatedAt: z.number().int().nonnegative(), // Unix seconds; never reset by renewal
  // Attached server-side by getSessionServerFn (not part of the JWT)
  householdName: z.string().optional(),
})

export const legacySessionClaimsSchema = sessionIdentitySchema.extend({
  sessionId: z.never().optional(),
  authenticatedAt: z.never().optional(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
})

export const sessionClaimsSchema = sessionSchema.omit({ householdName: true }).extend({
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
})

// Internal adapter metadata, never return this object from a server function.
export const sessionTransportSchema = z.object({
  token: z.string(),
  expiresAt: z.number().int().positive(),
})

export type SessionIdentity = z.infer<typeof sessionIdentitySchema>
export type SessionTransport = z.infer<typeof sessionTransportSchema>

export type User = z.infer<typeof userSchema>
export type Session = z.infer<typeof sessionSchema>
export type Category = z.infer<typeof categorySchema>
export type Store = z.infer<typeof storeSchema>
export type GroceryItem = z.infer<typeof groceryItemSchema>
export type HouseholdLog = z.infer<typeof householdLogSchema>
