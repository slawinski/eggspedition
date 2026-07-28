import { validateReturnTo } from './return-intent'

/** ─── Post-Auth Destination Types ─── */

export type PostAuthState =
  | { type: 'invite'; token: string }
  | { type: 'add-item'; name?: string; quantity?: string; category?: string; store?: string }
  | { type: 'onboarding' }
  | { type: 'list'; returnTo?: string }

export type PostAuthDestination = {
  to: string
  search?: Record<string, unknown>
  replace: boolean
}

/** ─── Post-Auth Routing ───
 *
 * Determines where to send the user after successful authentication.
 *
 * Priority:
 *  1. Invite token present → redirect to invite acceptance
 *  2. returnTo + name (add-item intent) → go home with composer open
 *     (only if user already has a household; otherwise onboarding first)
 *  3. No household → onboarding
 *  4. Everything normal → list (or validated returnTo)
 */

export function resolvePostAuthDestination(params: {
  returnTo?: string
  invite?: string
  name?: string
  quantity?: string
  category?: string
  store?: string
  hasHousehold: boolean
}): PostAuthDestination {
  const { returnTo, invite, name, quantity, category, store, hasHousehold } = params

  // ═══ Priority 1: Invite acceptance ───
  if (invite) {
    return {
      to: `/join/${invite}`,
      search: {
        ...(name && { name }),
        ...(quantity && { quantity }),
        ...(category && { category }),
        ...(store && { store }),
      },
      replace: true,
    }
  }

  // ═══ Priority 2: Add-item intent ───
  if (returnTo && name) {
    const validated = validateReturnTo(returnTo)

    if (hasHousehold) {
      // User has a household → go to list with composer open
      return {
        to: validated || '/',
        search: {
          add: 'item' as const,
          name,
          ...(quantity && { quantity }),
          ...(category && { category }),
          ...(store && { store }),
        },
        replace: true,
      }
    }

    // No household → onboarding first, preserve add-item intent
    return {
      to: '/onboarding/household',
      search: {
        name,
        ...(quantity && { quantity }),
        ...(category && { category }),
        ...(store && { store }),
      },
      replace: true,
    }
  }

  // ═══ Priority 3: No household → onboarding ───
  if (!hasHousehold) {
    return {
      to: '/onboarding/household',
      search:
        name || quantity || category || store
          ? {
              ...(name && { name }),
              ...(quantity && { quantity }),
              ...(category && { category }),
              ...(store && { store }),
            }
          : undefined,
      replace: true,
    }
  }

  // ═══ Priority 4: Normal flow ───
  const validated = validateReturnTo(returnTo)
  return {
    to: validated || '/',
    replace: true,
  }
}
