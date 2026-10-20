import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

const origin = 'https://eggs.example'
const source = readFileSync(new URL('./sw.js', import.meta.url), 'utf8')
const html = (body = 'signed-in list') => new Response(body, { headers: { 'Content-Type': 'text/html' } })
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function worker() {
  const handlers = new Map<string, (event: any) => void>()
  const stores = new Map<string, Map<string, Response>>()
  const key = (request: string | { url: string }) => new URL(typeof request === 'string' ? request : request.url, origin).href
  let putGate: Promise<void> | undefined
  let openGate: Promise<void> | undefined
  let putStarted = () => {}
  let openStarted = () => {}
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)!
    return {
      addAll: async (paths: string[]) => { paths.forEach((path) => store.set(key(path), new Response('static'))) },
      keys: async () => [...store.keys()].map((url) => ({ url })),
      match: async (request: string | { url: string }) => store.get(key(request))?.clone(),
      delete: async (request: string | { url: string }) => store.delete(key(request)),
      put: async (request: string | { url: string }, response: Response) => {
        const gate = putGate
        putGate = undefined
        if (gate) { putStarted(); await gate }
        store.set(key(request), response)
      },
    }
  }
  const caches = {
    open: async (name: string) => {
      const gate = openGate
      openGate = undefined
      if (gate) { openStarted(); await gate }
      return cache(name)
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: string | { url: string }) => {
      for (const store of stores.values()) {
        const response = store.get(key(request))
        if (response) return response.clone()
      }
    },
  }
  const fetch = vi.fn().mockImplementation(async () => html())
  runInNewContext(source, {
    self: { location: { origin }, addEventListener: (type: string, fn: (event: any) => void) => handlers.set(type, fn), skipWaiting: vi.fn(), clients: { claim: vi.fn() } },
    caches, fetch, Response, URL, console,
  })
  function lifecycle(type: string, extra = {}) {
    const work: Promise<unknown>[] = []
    handlers.get(type)!({ ...extra, waitUntil: (promise: Promise<unknown>) => work.push(promise) })
    return Promise.all(work)
  }
  return {
    cache: cache('eggspedition-v3'), caches, fetch,
    pausePut: (gate: Promise<void>) => {
      putGate = gate
      return new Promise<void>((resolve) => { putStarted = resolve })
    },
    pauseOpen: (gate: Promise<void>) => {
      openGate = gate
      return new Promise<void>((resolve) => { openStarted = resolve })
    },
    lifecycle,
    logout: (ack = vi.fn()) => ({ done: lifecycle('message', { data: { type: 'clear-auth-navigations' }, ports: [{ postMessage: ack }] }), ack }),
    request: (path: string, mode = 'navigate', method = 'GET') => {
      let response: Promise<Response> | undefined
      const work: Promise<unknown>[] = []
      handlers.get('fetch')!({ request: { url: key(path), method, mode }, respondWith: (promise: Promise<Response>) => { response = promise }, waitUntil: (promise: Promise<unknown>) => work.push(promise) })
      return { response, settled: async () => { await response; await Promise.all(work) } }
    },
  }
}

it('updates old caches without precaching a session-bearing root', async () => {
  const sw = worker()
  await (await sw.caches.open('eggspedition-v2')).put('/', html('old session'))
  await sw.lifecycle('install')
  await sw.lifecycle('activate')
  expect(await sw.caches.keys()).toEqual(['eggspedition-v3'])
  expect(await sw.cache.match('/')).toBeUndefined()
  expect(await sw.cache.match('/manifest.json')).toBeTruthy()
})

it.each(['/login', '/login?returnTo=%2F', '/api/auth/verify?token=fixture', '/_serverFn/session', '/_serverFn/auth?data=fixture'])('never reuses cached authorization for %s', async (path) => {
  const sw = worker()
  await sw.cache.put('/', html())
  await sw.cache.put(path, html('stale auth'))
  sw.fetch.mockRejectedValue(new TypeError('offline'))
  const response = await sw.request(path, path.includes('_serverFn') ? 'cors' : 'navigate').response!
  expect(response.status).toBe(503)
  expect(await response.text()).toContain('Sign-in needs an internet connection')
  expect(sw.fetch).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining(path.split('?')[0]) }), { cache: 'no-store' })
})

it('does not cache online auth responses, but preserves static assets and normal offline list navigation', async () => {
  const sw = worker()
  await sw.request('/login').settled()
  await sw.request('/_serverFn/session', 'cors').settled()
  expect(await sw.cache.match('/login')).toBeUndefined()
  expect(await sw.cache.match('/_serverFn/session')).toBeUndefined()
  await sw.request('/').settled()
  sw.fetch.mockResolvedValueOnce(new Response('javascript', { headers: { 'Content-Type': 'text/javascript' } }))
  await sw.request('/assets/app.js', 'cors').settled()
  // Static writes are asynchronous in the incumbent worker.
  await Promise.resolve()
  sw.fetch.mockRejectedValue(new TypeError('offline'))
  expect(await (await sw.request('/').response!).text()).toBe('signed-in list')
  expect(await (await sw.request('/assets/app.js', 'cors').response!).text()).toBe('javascript')
  const { done, ack } = sw.logout()
  await done
  expect(ack).toHaveBeenCalledWith({ type: 'auth-navigations-cleared' })
  expect(await sw.cache.match('/')).toBeUndefined()
  expect(await sw.cache.match('/assets/app.js')).toBeTruthy()
  expect((await sw.request('/').response!).status).toBe(503)
  expect((await sw.request('/login').response!).status).toBe(503)
  sw.fetch.mockResolvedValue(html('live signed out'))
  expect(await (await sw.request('/').response!).text()).toBe('live signed out')
})

it('does not cache a redirected login document under a protected URL', async () => {
  const sw = worker()
  const response = html('sign in')
  Object.defineProperty(response, 'url', { value: `${origin}/login` })
  sw.fetch.mockResolvedValue(response)
  await sw.request('/settings/household').settled()
  expect(await sw.cache.match('/settings/household')).toBeUndefined()
})

it('a prelogout fetch finishing after ACK cannot repopulate HTML', async () => {
  const sw = worker()
  const network = deferred<Response>()
  sw.fetch.mockReturnValueOnce(network.promise)
  const oldNavigation = sw.request('/')
  const { done, ack } = sw.logout()
  await done
  expect(ack).toHaveBeenCalledOnce()
  network.resolve(html('late authenticated document'))
  await oldNavigation.settled()
  expect(await sw.cache.match('/')).toBeUndefined()
})

it('ACK waits for an already running HTML write, then removes it', async () => {
  const sw = worker()
  const gate = deferred<void>()
  const started = sw.pausePut(gate.promise)
  const navigation = sw.request('/')
  await navigation.response
  await started
  const { done, ack } = sw.logout()
  await Promise.resolve()
  expect(ack).not.toHaveBeenCalled()
  gate.resolve()
  await done
  await navigation.settled()
  expect(ack).toHaveBeenCalledOnce()
  expect(await sw.cache.match('/')).toBeUndefined()
})

it('rechecks the epoch when cache.open yields to logout', async () => {
  const sw = worker()
  const gate = deferred<void>()
  const started = sw.pauseOpen(gate.promise)
  const navigation = sw.request('/')
  await navigation.response
  await started
  const { done } = sw.logout()
  gate.resolve()
  await done
  await navigation.settled()
  expect(await sw.cache.match('/')).toBeUndefined()
})

it('does not intercept other-origin or non-GET requests', () => {
  const sw = worker()
  expect(sw.request('https://other.example/login').response).toBeUndefined()
  expect(sw.request('/_serverFn/login', 'cors', 'POST').response).toBeUndefined()
})
