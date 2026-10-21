// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

// Start's dependency optimization otherwise gives the route a second React instance.
vi.mock('react', async () => {
  const { createRequire } = await import('node:module')
  const react = createRequire(import.meta.url)('react')
  return { ...react, default: react }
})

const mocks = vi.hoisted(() => ({
  login: vi.fn(), verify: vi.fn(), beginRegistration: vi.fn(), finishRegistration: vi.fn(),
  beginAuthentication: vi.fn(), finishAuthentication: vi.fn(),
  register: vi.fn(), authenticate: vi.fn(), cancel: vi.fn(), supports: vi.fn(),
  invalidate: vi.fn(), navigate: vi.fn(), search: {} as Record<string, string>,
  session: null as { householdId: string } | null,
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  createFileRoute: () => (options: object) => ({ options, useSearch: () => mocks.search, useRouteContext: () => ({ session: mocks.session }) }),
  useRouter: () => ({ invalidate: mocks.invalidate, navigate: mocks.navigate }),
  useNavigate: () => mocks.navigate,
}))
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock('../services/auth.api', () => ({
  loginServerFn: mocks.login, verifyEmailCodeServerFn: mocks.verify,
  beginPasskeyRegistrationServerFn: mocks.beginRegistration,
  finishPasskeyRegistrationServerFn: mocks.finishRegistration,
  beginPasskeyAuthenticationServerFn: mocks.beginAuthentication,
  finishPasskeyAuthenticationServerFn: mocks.finishAuthentication,
}))
vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: mocks.supports, startRegistration: mocks.register,
  startAuthentication: mocks.authenticate, WebAuthnAbortService: { cancelCeremony: mocks.cancel },
}))
vi.mock('../components/AddItemForm', () => ({ default: () => null }))
vi.mock('../components/SmartView', () => ({ default: () => null }))
vi.mock('../components/landing/LandingPage', () => ({ default: () => <p>Browser landing</p> }))
vi.mock('../services/grocery.api', () => ({
  getGroceryItemsFn: vi.fn(), getGroceryItemsGroupedFn: vi.fn(), getCategoriesFn: vi.fn(), getStoresFn: vi.fn(), getHouseholdLogsFn: vi.fn(),
}))
import { LoginComponent } from './login'
import { Home } from './index'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.search = {}
  mocks.session = null
  mocks.supports.mockReturnValue(true)
  mocks.login.mockResolvedValue({ status: 'sent', requestId: 'request', expiresAt: Date.now() + 600000, resendAt: Date.now() + 60000 })
  mocks.verify.mockResolvedValue({ status: 'authenticated', hasHousehold: true })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function requestCode() {
  await showLogin()
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'shopper@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))
  return screen.findByLabelText('Six-digit code')
}

async function showLogin() {
  await act(async () => { render(<Suspense fallback="Loading"><LoginComponent /></Suspense>) })
  await screen.findByRole('heading', { name: 'Sign in to Eggspedition', level: 1 })
}

async function authenticateWithCode() {
  fireEvent.change(await requestCode(), { target: { value: '001234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))
  await screen.findByRole('button', { name: 'Continue without a passkey' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue without a passkey' }).hasAttribute('disabled')).toBe(false))
}

it('requests an entered code and offers optional enrollment without navigating', async () => {
  const code = await requestCode()
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByRole('heading', { name: 'Check your email' })).toBeTruthy()
  expect(document.activeElement).toBe(code)
  expect(code.getAttribute('inputmode')).toBe('numeric')
  expect(code.getAttribute('autocomplete')).toBe('one-time-code')
  expect(code.getAttribute('maxlength')).toBe('6')
  fireEvent.change(code, { target: { value: '001234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))
  await screen.findByRole('button', { name: 'Set up passkey' })
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'You’re signed in', level: 1 }))
  expect(mocks.verify).toHaveBeenCalledWith({ data: { requestId: 'request', code: '001234' } })
  expect(mocks.invalidate).toHaveBeenCalled()
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(mocks.register).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Continue without a passkey' }))
  expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', replace: true })
})

it.each(['expired', 'consumed', 'attempt_limit', 'admission_denied', 'ambiguous_identity', 'invalid'])('keeps code recovery usable after %s', async (status) => {
  mocks.verify.mockResolvedValue({ status, attemptsRemaining: 3 })
  fireEvent.change(await requestCode(), { target: { value: '000000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Six-digit code').hasAttribute('disabled')).toBe(false)
  expect(mocks.invalidate).not.toHaveBeenCalled()
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /Resend code in/ }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Change email' }))
  expect(screen.getByLabelText('Your email')).toBeTruthy()
})

it.each(['rate_limited', 'delivery_failed'])('honors the %s retry deadline', async (status) => {
  mocks.login.mockResolvedValue({ status, retryAfter: 120 })
  await showLogin()
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'shopper@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: /Send code in 12[01]s/ }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByLabelText('Your email').hasAttribute('disabled')).toBe(false)
})

it('resends with the new request ID and blocks repeated taps', async () => {
  mocks.login.mockResolvedValue({ status: 'sent', requestId: 'first', expiresAt: Date.now() + 600000, resendAt: 0 })
  await requestCode()
  let deliver!: (value: unknown) => void
  mocks.login.mockImplementation(() => new Promise((resolve) => { deliver = resolve }))
  fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))
  fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))
  expect(mocks.login).toHaveBeenCalledTimes(2)
  await act(async () => deliver({ status: 'sent', requestId: 'second', expiresAt: Date.now() + 600000, resendAt: 0 }))
  fireEvent.change(screen.getByLabelText('Six-digit code'), { target: { value: '000001' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))
  await screen.findByRole('button', { name: 'Set up passkey' })
  expect(mocks.verify).toHaveBeenCalledWith({ data: { requestId: 'second', code: '000001' } })
})

it.each([true, false])('preserves full item intent through skipped enrollment (household=%s)', async (hasHousehold) => {
  mocks.search = { returnTo: '/', name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' }
  mocks.verify.mockResolvedValue({ status: 'authenticated', hasHousehold })
  await authenticateWithCode()
  fireEvent.click(screen.getByRole('button', { name: 'Continue without a passkey' }))
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: hasHousehold ? '/' : '/onboarding/household', replace: true,
    search: { ...(hasHousehold ? { add: 'item' } : {}), name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' },
  })
})

it.each(['registered', 'duplicate', 'invalid', 'unauthenticated', 'cancelled'])('continues authenticated after enrollment result %s', async (status) => {
  mocks.search = { invite: 'household-invite', name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' }
  mocks.beginRegistration.mockResolvedValue({ status: 'options', requestId: 'registration', optionsJSON: { challenge: 'fixture' } })
  mocks.register.mockImplementation(() => status === 'cancelled' ? Promise.reject(new DOMException('Cancelled', 'NotAllowedError')) : Promise.resolve({ id: 'credential' }))
  mocks.finishRegistration.mockResolvedValue({ status })
  await authenticateWithCode()
  fireEvent.click(screen.getByRole('button', { name: 'Set up passkey' }))
  await screen.findByRole('button', { name: 'Create passkey on this device' })
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Create your passkey', level: 1 }))
  expect(mocks.register).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Create passkey on this device' }))
  if (status !== 'registered') {
    await screen.findByRole('alert')
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'You’re signed in', level: 1 }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue without a passkey' }))
  }
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/join/household-invite', replace: true, search: { name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' } }))
  expect(mocks.register).toHaveBeenCalledWith({ optionsJSON: { challenge: 'fixture' } })
})

it.each(['authenticated', 'invalid', 'admission_denied', 'cancelled'])('handles explicit returning passkey result %s without email input', async (status) => {
  mocks.search = { returnTo: '/settings/household' }
  mocks.beginAuthentication.mockResolvedValue({ status: 'options', requestId: 'authentication', optionsJSON: { challenge: 'fixture' } })
  mocks.authenticate.mockImplementation(() => status === 'cancelled' ? Promise.reject(new DOMException('Cancelled', 'NotAllowedError')) : Promise.resolve({ id: 'credential' }))
  mocks.finishAuthentication.mockResolvedValue({ status, hasHousehold: true })
  await showLogin()
  expect(mocks.beginAuthentication).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
  await screen.findByRole('button', { name: 'Use device passkey' })
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Sign in with your passkey', level: 1 }))
  expect(mocks.authenticate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Use device passkey' }))
  if (status === 'authenticated') {
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/settings/household', replace: true }))
    expect(mocks.invalidate).toHaveBeenCalledWith({ sync: true })
  } else {
    await screen.findByRole('alert')
    expect(document.activeElement).toBe(screen.getByLabelText('Your email'))
    expect(screen.getByRole('button', { name: 'Send email code' }).hasAttribute('disabled')).toBe(false)
    expect(mocks.navigate).not.toHaveBeenCalled()
  }
  expect(mocks.login).not.toHaveBeenCalled()
})

it('ignores late options after switching back to email', async () => {
  let finish!: (value: unknown) => void
  mocks.beginAuthentication.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  await showLogin()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
  fireEvent.click(screen.getByRole('button', { name: 'Use email code instead' }))
  expect(document.activeElement).toBe(screen.getByLabelText('Your email'))
  await act(async () => finish({ status: 'options', requestId: 'late', optionsJSON: {} }))
  expect(screen.queryByRole('button', { name: 'Use device passkey' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Send email code' }).hasAttribute('disabled')).toBe(false)
  expect(mocks.cancel).toHaveBeenCalled()
})

it('aborts a pending browser ceremony on switch and unmount without finishing it', async () => {
  mocks.beginAuthentication.mockResolvedValue({ status: 'options', requestId: 'authentication', optionsJSON: {} })
  let finish!: (value: unknown) => void
  mocks.authenticate.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  await showLogin()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use device passkey' }))
  fireEvent.click(screen.getByRole('button', { name: 'Use email code instead' }))
  await act(async () => finish({ id: 'late' }))
  expect(mocks.finishAuthentication).not.toHaveBeenCalled()
  cleanup()
  expect(mocks.cancel).toHaveBeenCalledTimes(2)
})

it('retains email on unsupported devices and explains offline authentication', async () => {
  mocks.supports.mockReturnValue(false)
  await showLogin()
  expect(screen.queryByRole('button', { name: 'Sign in with a passkey' })).toBeNull()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  fireEvent(window, new Event('offline'))
  expect(screen.getByRole('status').textContent).toContain('no need to reinstall')
  expect(screen.getByRole('button', { name: 'Send email code' }).hasAttribute('disabled')).toBe(true)
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  fireEvent(window, new Event('online'))
  expect(screen.getByRole('button', { name: 'Send email code' }).hasAttribute('disabled')).toBe(false)
})

it.each(['admission_denied', 'invalid_input'])('allows correcting email after issuance %s', async (status) => {
  mocks.login.mockResolvedValue({ status })
  await showLogin()
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'shopper@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))
  await screen.findByRole('alert')
  expect(screen.queryByLabelText('Six-digit code')).toBeNull()
  expect(screen.getByLabelText('Your email').hasAttribute('disabled')).toBe(false)
  expect(screen.getByRole('button', { name: 'Send email code' }).hasAttribute('disabled')).toBe(false)
})

it('aborts a still-pending browser ceremony on unmount', async () => {
  mocks.beginAuthentication.mockResolvedValue({ status: 'options', requestId: 'authentication', optionsJSON: {} })
  let finish!: (value: unknown) => void
  mocks.authenticate.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  await showLogin()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use device passkey' }))
  cleanup()
  expect(mocks.cancel).toHaveBeenCalledOnce()
  await act(async () => finish({ id: 'late' }))
  expect(mocks.finishAuthentication).not.toHaveBeenCalled()
  expect(mocks.navigate).not.toHaveBeenCalled()
})

it.each([true, false])('only routes signed-out standalone home directly to recovery (standalone=%s)', async (standalone) => {
  vi.stubGlobal('matchMedia', () => ({ matches: standalone }))
  mocks.search = { name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' }
  await act(async () => { render(<Home />) })
  if (standalone) {
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/login', search: { ...mocks.search, returnTo: '/' }, replace: true })
  } else {
    expect(screen.getByText('Browser landing')).toBeTruthy()
    expect(mocks.navigate).not.toHaveBeenCalled()
  }
})

it('leaves enrollment when Header logout refreshes session context', async () => {
  mocks.invalidate.mockImplementation(async () => { mocks.session = { householdId: 'household' } })
  const view = render(<LoginComponent />)
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'shopper@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))
  fireEvent.change(await screen.findByLabelText('Six-digit code'), { target: { value: '001234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }))
  await screen.findByRole('heading', { name: 'You’re signed in' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue without a passkey' }).hasAttribute('disabled')).toBe(false))
  mocks.session = null
  // Rerender the existing route, as the root context update does (not a remount).
  view.rerender(<LoginComponent />)
  expect(screen.queryByRole('heading', { name: 'You’re signed in' })).toBeNull()
  expect(screen.getByLabelText('Your email')).toBeTruthy()
})

it('normalizes email whitespace and case before requesting a code', async () => {
  await showLogin()
  // NBSP survives type=email's native ASCII-whitespace sanitization, so this
  // exercises the shared schema's trim rather than the browser's input cleanup.
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: '\u00a0Shopper@EXAMPLE.COM\u00a0' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))
  await screen.findByLabelText('Six-digit code')
  expect(mocks.login).toHaveBeenCalledExactlyOnceWith({ data: { email: 'shopper@example.com' } })
  expect(screen.getByText('shopper@example.com')).toBeTruthy()
})

it('shows shared-schema validation for invalid email without requesting a code', async () => {
  await showLogin()
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'not-an-email' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Please enter a valid email address')
  expect(mocks.login).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Six-digit code')).toBeNull()
})

it('keeps task focus stable through pending updates and countdown ticks', async () => {
  mocks.beginAuthentication.mockResolvedValue({ status: 'options', requestId: 'authentication', optionsJSON: {} })
  mocks.authenticate.mockImplementation(() => new Promise(() => {}))
  await showLogin()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
  const heading = await screen.findByRole('heading', { name: 'Sign in with your passkey' })
  fireEvent.click(screen.getByRole('button', { name: 'Use device passkey' }))
  expect(screen.getByRole('status').textContent).toBe('Please wait…')
  expect(document.activeElement).toBe(heading)
  const fallback = screen.getByRole('button', { name: 'Use email code instead' })
  fallback.focus()
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)) })
  expect(document.activeElement).toBe(fallback)
})

it('offers continuation after email sign-in on unsupported devices', async () => {
  mocks.supports.mockReturnValue(false)
  await authenticateWithCode()
  expect(screen.queryByRole('button', { name: 'Set up passkey' })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'You’re signed in' }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue without a passkey' }))
  expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', replace: true })
})

it.each([true, false])('honors an invitation returnTo before household routing (household=%s)', async (hasHousehold) => {
  mocks.search = { returnTo: '/join/household-invite', name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' }
  mocks.verify.mockResolvedValue({ status: 'authenticated', hasHousehold })
  await authenticateWithCode()
  fireEvent.click(screen.getByRole('button', { name: 'Continue without a passkey' }))
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: '/join/household-invite', replace: true,
    search: { name: 'Milk', quantity: '2', category: 'Dairy', store: 'Market' },
  })
})
