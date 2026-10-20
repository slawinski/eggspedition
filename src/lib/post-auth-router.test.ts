import { expect, it } from 'vitest'
import { resolvePostAuthDestination } from './post-auth-router'

const item = { name: 'Milk', quantity: '02', category: 'Dairy', store: 'Market' }

it('prioritizes invitation over household onboarding and keeps item fields', () => {
  expect(resolvePostAuthDestination({ ...item, returnTo: '/', invite: 'invite-id', hasHousehold: false })).toEqual({ to: '/join/invite-id', search: item, replace: true })
})
it('preserves the invitation return produced by the actual join route before household onboarding', () => {
  expect(resolvePostAuthDestination({ returnTo: '/join/invite-id', hasHousehold: false })).toEqual({
    to: '/join/invite-id', search: {}, replace: true,
  })
})
it.each([true, false])('preserves item intent with household=%s', (hasHousehold) => {
  expect(resolvePostAuthDestination({ ...item, returnTo: '/', hasHousehold })).toEqual({
    to: hasHousehold ? '/' : '/onboarding/household',
    search: { ...(hasHousehold ? { add: 'item' } : {}), ...item }, replace: true,
  })
})
it('uses validated return paths and normal onboarding', () => {
  expect(resolvePostAuthDestination({ returnTo: '/settings/household', hasHousehold: true })).toEqual({ to: '/settings/household', replace: true })
  expect(resolvePostAuthDestination({ hasHousehold: false })).toEqual({ to: '/onboarding/household', search: undefined, replace: true })
})
it.each(['https://evil.example', '//evil.example', 'javascript:alert(1)', '/\nevil', '/\\evil.example'])('rejects external or unsafe return %s', (returnTo) => {
  expect(resolvePostAuthDestination({ returnTo, hasHousehold: true }).to).toBe('/')
  expect(resolvePostAuthDestination({ ...item, returnTo, hasHousehold: true }).to).toBe('/')
})
