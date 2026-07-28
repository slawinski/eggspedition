import { randomBytes } from 'crypto'
import { db } from '../db'
import { households, memberships, invites, users } from '../db/schema'
import { eq, and, isNull, desc, count } from 'drizzle-orm'

function generateInviteToken(): string {
  return randomBytes(9).toString('base64url')
}

export async function createHousehold(userId: string, name?: string) {
  const [household] = await db
    .insert(households)
    .values({ name: name?.trim() || 'My Household' })
    .returning()

  if (!household) throw new Error('Failed to create household')

  await db.insert(memberships).values({
    userId,
    householdId: household.id,
    role: 'admin',
  })

  return household
}

export async function createInvite(
  householdId: string,
  createdBy: string,
  expiresAt?: Date,
) {
  // Verify creator is a member of this household
  const [member] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, createdBy),
        eq(memberships.householdId, householdId),
      ),
    )
    .limit(1)

  if (!member) throw new Error('You are not a member of this household')

  const token = generateInviteToken()

  const [invite] = await db
    .insert(invites)
    .values({
      householdId,
      token,
      createdBy,
      expiresAt: expiresAt || undefined,
    })
    .returning()

  if (!invite) throw new Error('Failed to create invite')

  return invite
}

export async function previewInvite(token: string) {
  const [invite] = await db
    .select({
      householdName: households.name,
      inviterEmail: users.email,
      householdId: invites.householdId,
      expiresAt: invites.expiresAt,
      redeemedAt: invites.redeemedAt,
      revokedAt: invites.revokedAt,
    })
    .from(invites)
    .innerJoin(households, eq(invites.householdId, households.id))
    .innerJoin(users, eq(invites.createdBy, users.id))
    .where(eq(invites.token, token))
    .limit(1)

  if (!invite) return { status: 'not_found' as const }

  if (invite.revokedAt) return { status: 'revoked' as const }
  if (invite.redeemedAt) return { status: 'redeemed' as const }
  if (invite.expiresAt && invite.expiresAt < new Date()) return { status: 'expired' as const }

  return {
    status: 'valid' as const,
    householdName: invite.householdName,
    inviterEmail: invite.inviterEmail,
    householdId: invite.householdId,
  }
}

export async function acceptInvite(token: string, userId: string) {
  // Find the invite
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1)

  if (!invite) throw new Error('Invite not found')

  // Validate invite state
  if (invite.revokedAt) throw new Error('This invite has been revoked')
  if (invite.redeemedAt) throw new Error('This invite has already been used')
  if (invite.expiresAt && invite.expiresAt < new Date()) throw new Error('This invite has expired')

  // Join household (gracefully handles existing membership)
  const [existing] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.householdId, invite.householdId),
      ),
    )
    .limit(1)

  if (!existing) {
    await db.insert(memberships).values({
      userId,
      householdId: invite.householdId,
      role: 'member',
    })
  }

  // Mark invite as redeemed
  await db
    .update(invites)
    .set({ redeemedAt: new Date(), redeemedBy: userId })
    .where(eq(invites.id, invite.id))

  return invite.householdId
}

export async function revokeInvite(inviteId: string, userId: string) {
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.id, inviteId))
    .limit(1)

  if (!invite) throw new Error('Invite not found')

  // Verify the user is a member of this household
  const [member] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.householdId, invite.householdId),
      ),
    )
    .limit(1)

  if (!member) throw new Error('You are not a member of this household')

  if (invite.redeemedAt) throw new Error('This invite has already been redeemed')

  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(eq(invites.id, inviteId))
}

export async function getHouseholdMembers(householdId: string) {
  return await db
    .select({
      userId: memberships.userId,
      email: users.email,
      name: users.name,
      role: memberships.role,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.householdId, householdId))
    .orderBy(desc(memberships.joinedAt))
}

export async function getPendingInvites(householdId: string) {
  return await db
    .select({
      id: invites.id,
      token: invites.token,
      createdAt: invites.createdAt,
      expiresAt: invites.expiresAt,
      createdByEmail: users.email,
    })
    .from(invites)
    .innerJoin(users, eq(invites.createdBy, users.id))
    .where(
      and(
        eq(invites.householdId, householdId),
        isNull(invites.redeemedAt),
        isNull(invites.revokedAt),
      ),
    )
    .orderBy(desc(invites.createdAt))
}

export async function getHouseholdName(householdId: string) {
  const [household] = await db
    .select({ name: households.name })
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1)

  return household?.name || 'My Household'
}

export async function updateHouseholdName(householdId: string, name: string) {
  const [updated] = await db
    .update(households)
    .set({ name: name.trim() })
    .where(eq(households.id, householdId))
    .returning()

  if (!updated) throw new Error('Household not found')
  return updated
}

export async function getHouseholdMemberCount(householdId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(memberships)
    .where(eq(memberships.householdId, householdId))

  return result?.count ?? 0
}

export async function joinExistingHousehold(userId: string, householdId: string) {
  const [existing] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.householdId, householdId),
      ),
    )
    .limit(1)

  if (existing) return householdId

  await db.insert(memberships).values({
    userId,
    householdId,
    role: 'member',
  })

  return householdId
}
