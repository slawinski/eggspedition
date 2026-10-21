// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('react', async () => {
  const { createRequire } = await import('node:module')
  const react = createRequire(import.meta.url)('react')
  return { ...react, default: react }
})
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  search: {} as Record<string, string>,
  recoverySearch: {} as Record<string, string>,
  loader: null as null | ((context: { deps: Record<string, string> }) => Promise<unknown>),
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  createFileRoute: () => (options: { loader: typeof mocks.loader; component: React.ComponentType }) => {
    mocks.loader = options.loader
    return { options, useLoaderData: () => ({ error: 'This sign-in link is invalid or has expired.' }), useSearch: () => mocks.search }
  },
  Link: ({ to, search, children, className }: { to: string; search: Record<string, string>; children: React.ReactNode; className: string }) => {
    mocks.recoverySearch = search
    return <a href={to} className={className}>{children}</a>
  },
  redirect: (destination: unknown) => destination,
}))
vi.mock('../../../services/auth.api', () => ({ verifyMagicLinkServerFn: mocks.verify }))
import { Route } from './verify'
const Component = Route.options.component!

beforeEach(() => { mocks.search = {}; mocks.recoverySearch = {}; mocks.verify.mockReset() })
afterEach(cleanup)

it('announces failed-link recovery, focuses its task once, and preserves intent without a token', async () => {
  mocks.search = { token: 'invalid-fixture', invite: 'invitation', returnTo: '/settings/household', name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' }
  const view = await act(async () => render(<Suspense fallback="Loading"><Component /></Suspense>))
  const heading = await screen.findByRole('heading', { name: 'This sign-in link is unavailable', level: 1 })
  expect(document.activeElement).toBe(heading)
  expect(screen.getByRole('main').id).toBe('main-content')
  expect(screen.getByRole('alert').textContent).toContain('invalid or has expired')
  expect(screen.getByText(/without reinstalling/)).toBeTruthy()
  const link = screen.getByRole('link', { name: 'Request an email code' })
  expect(link.getAttribute('href')).toBe('/login')
  expect(mocks.recoverySearch).toEqual({ invite: 'invitation', returnTo: '/settings/household', name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' })
  link.focus()
  await act(async () => { view.rerender(<Suspense fallback="Loading"><Component /></Suspense>) })
  expect(document.activeElement).toBe(link)
})

it('keeps invalid loader results in recovery', async () => {
  mocks.verify.mockResolvedValue({ success: false })
  expect(await mocks.loader!({ deps: { token: 'invalid-fixture' } })).toEqual({ error: 'This sign-in link is invalid or has expired.' })
  expect(mocks.verify).toHaveBeenCalledWith({ data: 'invalid-fixture' })
})

it.each([true, false])('replaces successful links with the resolver destination (household=%s)', async (hasHousehold) => {
  mocks.verify.mockResolvedValue({ success: true, hasHousehold })
  await expect(mocks.loader!({ deps: { token: 'valid-fixture', returnTo: '/', name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' } })).rejects.toEqual({
    to: hasHousehold ? '/' : '/onboarding/household', replace: true,
    search: { ...(hasHousehold ? { add: 'item' } : {}), name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' },
  })
})
