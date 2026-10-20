// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { clearAuthNavigations, isStandalone } from './pwa-auth'
import Header from '../components/Header'

const auth = vi.hoisted(() => ({ logout: vi.fn(), clear: vi.fn(), invalidate: vi.fn() }))
vi.mock('react', async () => {
  const { createRequire } = await import('node:module')
  const react = createRequire(import.meta.url)('react')
  return { ...react, default: react }
})
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: auth.invalidate }),
  useRouterState: () => ({ location: { pathname: '/' } }),
  Link: () => null,
}))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ clear: auth.clear }) }))
vi.mock('../services/auth.api', () => ({ logoutServerFn: auth.logout }))
vi.mock('../routes/__root', () => ({ Route: { useRouteContext: () => ({ session: { email: 'shopper@example.com', householdId: 'household' } }) } }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../components/ui/SyncStatusButton', () => ({ default: () => null }))
vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }))
vi.mock('lucide-react', () => ({ ShoppingBasket: () => null, LogOut: () => null, User: () => null, ChevronDown: () => null, Settings: () => null }))

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); localStorage.clear() })

it('detects Safari standalone and display-mode without requiring either API', () => {
  expect(isStandalone()).toBe(false)
  vi.stubGlobal('window', { navigator: { standalone: true } })
  expect(isStandalone()).toBe(true)
  vi.stubGlobal('window', { navigator: {}, matchMedia: () => ({ matches: true }) })
  expect(isStandalone()).toBe(true)
  vi.stubGlobal('window', undefined)
  expect(isStandalone()).toBe(false)
})

it('does not claim cleanup until the worker ACK arrives', async () => {
  let acknowledge!: (event: { data: object }) => void
  const close = vi.fn()
  vi.stubGlobal('MessageChannel', class {
    port1 = { set onmessage(fn: typeof acknowledge) { acknowledge = fn }, close }
    port2 = {}
  })
  const postMessage = vi.fn()
  vi.stubGlobal('navigator', { serviceWorker: { controller: { postMessage } } })
  const done = vi.fn()
  const result = clearAuthNavigations().then(done)
  await Promise.resolve()
  expect(done).not.toHaveBeenCalled()
  expect(postMessage).toHaveBeenCalledWith({ type: 'clear-auth-navigations' }, [expect.any(Object)])
  acknowledge({ data: { type: 'auth-navigations-cleared' } })
  await result
  expect(done).toHaveBeenCalledOnce()
  expect(close).toHaveBeenCalledOnce()
})

it('needs no message without a controlling worker', async () => {
  vi.stubGlobal('navigator', {})
  await expect(clearAuthNavigations()).resolves.toBeUndefined()
  vi.stubGlobal('navigator', { serviceWorker: { controller: null } })
  await expect(clearAuthNavigations()).resolves.toBeUndefined()
})

it.each(['silent', 'failed'] as const)('retires a %s legacy worker and requests fresh navigation instead of hanging logout', async (mode) => {
  vi.useFakeTimers()
  let acknowledge!: (event: { data: object }) => void
  vi.stubGlobal('MessageChannel', class {
    port1 = { set onmessage(fn: typeof acknowledge) { acknowledge = fn }, close: vi.fn() }
    port2 = {}
  })
  const unregister = vi.fn().mockResolvedValue(true)
  vi.stubGlobal('navigator', { serviceWorker: {
    controller: { postMessage: vi.fn() },
    getRegistration: vi.fn().mockResolvedValue({ unregister }),
  } })
  const remove = vi.fn().mockResolvedValue(true)
  vi.stubGlobal('caches', { keys: async () => ['eggspedition-v2', 'unrelated-cache'], delete: remove })
  const pending = clearAuthNavigations()
  if (mode === 'failed') acknowledge({ data: { type: 'auth-navigation-clear-failed' } })
  await vi.advanceTimersByTimeAsync(5000)
  expect(await pending).toBe('reload')
  expect(unregister).toHaveBeenCalledOnce()
  expect(remove).toHaveBeenCalledWith('eggspedition-v2')
  expect(remove).not.toHaveBeenCalledWith('unrelated-cache')
})

it('Header preserves offline data until confirmed logout and waits for worker ACK before routing', async () => {
  let confirm!: () => void
  auth.logout.mockImplementation(() => new Promise<void>((resolve) => { confirm = resolve }))
  let acknowledge!: (event: { data: object }) => void
  vi.stubGlobal('MessageChannel', class {
    port1 = { set onmessage(fn: typeof acknowledge) { acknowledge = fn }, close: vi.fn() }
    port2 = {}
  })
  const postMessage = vi.fn()
  vi.stubGlobal('navigator', { serviceWorker: { controller: { postMessage } } })
  localStorage.setItem('REACT_QUERY_OFFLINE_CACHE', 'list data')
  localStorage.setItem('eggspedition:household', 'household data')
  localStorage.setItem('theme', 'dark')
  await act(async () => { render(createElement(Header)) })
  fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))
  expect(localStorage.getItem('REACT_QUERY_OFFLINE_CACHE')).toBe('list data')
  expect(auth.clear).not.toHaveBeenCalled()
  expect(postMessage).not.toHaveBeenCalled()
  await act(async () => confirm())
  expect(auth.clear).toHaveBeenCalledOnce()
  expect(localStorage.getItem('REACT_QUERY_OFFLINE_CACHE')).toBeNull()
  expect(localStorage.getItem('eggspedition:household')).toBeNull()
  expect(localStorage.getItem('theme')).toBe('dark')
  expect(postMessage).toHaveBeenCalledOnce()
  expect(auth.invalidate).not.toHaveBeenCalled()
  await act(async () => acknowledge({ data: { type: 'auth-navigations-cleared' } }))
  expect(auth.invalidate).toHaveBeenCalledWith({ sync: true })
})
