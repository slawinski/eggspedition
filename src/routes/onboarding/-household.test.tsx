// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

// Match the route tests' React instance across Start's dependency optimization.
vi.mock('react', async () => {
  const { createRequire } = await import('node:module')
  const react = createRequire(import.meta.url)('react')
  return { ...react, default: react }
})

const mocks = vi.hoisted(() => ({
  create: vi.fn(), accept: vi.fn(), invalidate: vi.fn(), navigate: vi.fn(),
  search: {} as Record<string, string>,
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  createFileRoute: () => (options: object) => ({ options, useSearch: () => mocks.search }),
  useNavigate: () => mocks.navigate,
}))
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }))
vi.mock('../../services/household.api', () => ({
  createHouseholdFn: mocks.create, acceptHouseholdInviteFn: mocks.accept,
}))

import { Route } from './household'

const intent = { name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' }
const HouseholdOnboarding = Route.options.component!
const beforeLoad = Route.options.beforeLoad!

beforeEach(() => {
  vi.resetAllMocks()
  // Exercise the actual route schema before passing search into the component.
  const validator = Route.options.validateSearch
  if (!validator || typeof validator === 'function' || !('parse' in validator)) throw new Error('Expected the route Zod validator')
  mocks.search = validator.parse(intent)
  mocks.create.mockResolvedValue({})
  mocks.accept.mockResolvedValue({})
})
afterEach(cleanup)

it.each([
  { session: null, destination: { to: '/login', search: { returnTo: '/onboarding/household', ...intent } } },
  { session: { householdId: 'household' }, destination: { to: '/', search: { add: 'item', ...intent } } },
])('preserves validated item intent in the entry redirect for session=$session', ({ session, destination }) => {
  // Only context/search are consumed by this guard; keep redirect itself real.
  const entry = { context: { session }, search: mocks.search } as Parameters<typeof beforeLoad>[0]
  expect(() => beforeLoad(entry)).toThrow(expect.objectContaining({ options: expect.objectContaining(destination) }))
})

it.each(['create', 'join'])('preserves full item intent after successful household %s', async (action) => {
  const entry = { context: { session: { userId: 'shopper' } }, search: mocks.search } as Parameters<typeof beforeLoad>[0]
  expect(beforeLoad(entry)).toBeUndefined()
  await act(async () => { render(<HouseholdOnboarding />) })
  await screen.findByRole('heading', { name: 'Set up your household' })

  if (action === 'create') {
    fireEvent.click(screen.getByRole('button', { name: /Start a household/ }))
  } else {
    fireEvent.click(screen.getByRole('button', { name: /Join a household/ }))
    fireEvent.change(screen.getByLabelText('Invite link or code'), { target: { value: 'household-invite' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join household' }))
  }

  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({
    to: '/', search: { add: 'item', ...intent }, replace: true,
  }))
  expect(mocks.invalidate).toHaveBeenCalledOnce()
  if (action === 'create') {
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ data: {} })
    expect(mocks.accept).not.toHaveBeenCalled()
  } else {
    expect(mocks.accept).toHaveBeenCalledExactlyOnceWith({ data: 'household-invite' })
    expect(mocks.create).not.toHaveBeenCalled()
  }
})
