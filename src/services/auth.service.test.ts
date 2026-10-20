import { afterEach, expect, it, vi } from 'vitest'
import { requestEmailCode, verifyEmailCode } from './auth.service'
import { authOrigin } from '../lib/auth-origin'

afterEach(() => vi.unstubAllEnvs())

it('rejects admission before sending mail or accessing the application database', async () => {
  vi.stubEnv('AUTH_WHITELIST', 'allowed@example.test')
  expect(await requestEmailCode('denied@example.test', 'installation-digest')).toEqual({ status: 'admission_denied' })
})

it('normalizes admission input, validates malformed email and rejects missing ceremony binding without DB access', async () => {
  vi.stubEnv('AUTH_WHITELIST', 'someone@example.test')
  expect(await requestEmailCode(' INVALID ', 'binding')).toEqual({ status: 'invalid_input' })
  expect(await requestEmailCode('someone@example.test', '')).toEqual({ status: 'invalid_input' })
  expect(await verifyEmailCode({ requestId: 'not-an-id', code: '123456' }, 'binding')).toEqual({ status: 'invalid' })
  expect(await verifyEmailCode({ requestId: '9a2a0fb3-2229-4c92-8372-09dd8a24860e', code: '123456' }, null)).toEqual({ status: 'invalid' })
})

it('derives exact origin and RP ID from configured URL, allowing HTTP only for development localhost', () => {
  vi.stubEnv('BASE_URL', 'https://eggs.example.test:8443/app')
  expect(authOrigin()).toEqual({ expectedOrigin: 'https://eggs.example.test:8443', rpID: 'eggs.example.test' })
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('BASE_URL', 'http://localhost:3000')
  expect(authOrigin()).toEqual({ expectedOrigin: 'http://localhost:3000', rpID: 'localhost' })
  vi.stubEnv('BASE_URL', 'http://eggs.example.test')
  expect(() => authOrigin()).toThrow('HTTPS')
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('BASE_URL', 'http://localhost:3000')
  expect(() => authOrigin()).toThrow('HTTPS')
  vi.stubEnv('BASE_URL', 'https://user:password@eggs.example.test')
  expect(() => authOrigin()).toThrow('HTTPS')
})
