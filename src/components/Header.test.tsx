// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('react', async () => {
  const { createRequire } = await import('node:module')
  const react = createRequire(import.meta.url)('react')
  return { ...react, default: react }
})
const mocks = vi.hoisted(() => ({
  pathname: '/login',
  session: null as { householdId: string | null; householdName: string; email: string } | null,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => <a href={to} {...props}>{children}</a>,
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouterState: () => ({ location: { pathname: mocks.pathname } }),
}))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ clear: vi.fn() }) }))
vi.mock('../routes/__root', () => ({ Route: { useRouteContext: () => ({ session: mocks.session }) } }))
vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }))
vi.mock('../services/auth.api', () => ({ logoutServerFn: vi.fn() }))
vi.mock('../lib/pwa-auth', () => ({ clearAuthNavigations: vi.fn() }))
vi.mock('./ThemeToggle', () => ({ default: () => <button>Theme</button> }))
vi.mock('./ui/SyncStatusButton', () => ({ default: () => <button>Sync</button> }))
import Header from './Header'

beforeEach(() => { mocks.pathname = '/login'; mocks.session = null })
afterEach(cleanup)

function expectAuthHeader() {
  expect(screen.getByRole('link', { name: 'Eggspedition' }).getAttribute('href')).toBe('/')
  expect(screen.getByRole('button', { name: 'Theme' })).toBeTruthy()
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getAllByRole('button')).toHaveLength(1)
  expect(screen.queryByRole('heading')).toBeNull()
}

it.each(['/login', '/login/', '/api/auth/verify', '/api/auth/verify/'])('keeps focused auth chrome on %s through session refreshes', (pathname) => {
  mocks.pathname = pathname
  const view = render(<Header />)
  expectAuthHeader()
  for (const householdId of ['household', null]) {
    mocks.session = { householdId, householdName: 'Family', email: 'shopper@example.com' }
    view.rerender(<Header />)
    expectAuthHeader()
  }
})

it.each(['/api/auth/other', '/login-extra', '/api/auth/verify-extra', '/'])('retains public navigation outside auth surfaces (%s)', (pathname) => {
  mocks.pathname = pathname
  render(<Header />)
  expect(screen.getByRole('link', { name: 'How it works' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Features' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Start your list' })).toBeTruthy()
})

it('restores household controls when leaving authentication', () => {
  mocks.session = { householdId: 'household', householdName: 'Family', email: 'shopper@example.com' }
  const view = render(<Header />)
  expectAuthHeader()
  mocks.pathname = '/settings/household'
  view.rerender(<Header />)
  expect(screen.getByText('Family')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Open account menu' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sync' })).toBeTruthy()
  mocks.session = null
  mocks.pathname = '/'
  view.rerender(<Header />)
  expect(screen.getByRole('link', { name: 'Start your list' })).toBeTruthy()
})
