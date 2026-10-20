import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { browserSupportsWebAuthn, startAuthentication, startRegistration, WebAuthnAbortService } from '@simplewebauthn/browser'
import { loginServerFn, verifyEmailCodeServerFn, beginPasskeyRegistrationServerFn, finishPasskeyRegistrationServerFn, beginPasskeyAuthenticationServerFn, finishPasskeyAuthenticationServerFn } from '../services/auth.api'
import { resolvePostAuthDestination } from '../lib/post-auth-router'
import { requestEmailCodeSchema } from '../lib/auth-inputs'
import clay from '../styles/clay.module.css'
import styles from './login.module.css'
import { z } from 'zod'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    returnTo: z.string().optional(), invite: z.string().optional(),
    name: z.string().optional(), quantity: z.string().optional(),
    category: z.string().optional(), store: z.string().optional(),
  }),
  component: LoginComponent,
})

type CodeRequest = Extract<Awaited<ReturnType<typeof loginServerFn>>, { status: 'sent' }>
type PasskeyOptions =
  | { kind: 'registration'; data: Extract<Awaited<ReturnType<typeof beginPasskeyRegistrationServerFn>>, { status: 'options' }> }
  | { kind: 'authentication'; data: Awaited<ReturnType<typeof beginPasskeyAuthenticationServerFn>> }

export function LoginComponent() {
  const search = Route.useSearch()
  const { session } = Route.useRouteContext()
  const router = useRouter()
  const login = useServerFn(loginServerFn)
  const verify = useServerFn(verifyEmailCodeServerFn)
  const beginRegistration = useServerFn(beginPasskeyRegistrationServerFn)
  const finishRegistration = useServerFn(finishPasskeyRegistrationServerFn)
  const beginAuthentication = useServerFn(beginPasskeyAuthenticationServerFn)
  const finishAuthentication = useServerFn(finishPasskeyAuthenticationServerFn)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [request, setRequest] = useState<CodeRequest | null>(null)
  const [household, setHousehold] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [canCancel, setCanCancel] = useState(false)
  const [supported, setSupported] = useState(false)
  const [online, setOnline] = useState(true)
  const [now, setNow] = useState(0)
  const [retryAt, setRetryAt] = useState(0)
  const [options, setOptions] = useState<PasskeyOptions | null>(null)
  const operation = useRef(0)
  const locked = useRef(false)
  const focusTarget = useRef<HTMLInputElement>(null)
  const enrollmentHeading = useRef<HTMLHeadingElement>(null)
  const hadSession = useRef(!!session)

  useEffect(() => {
    setSupported(browserSupportsWebAuthn())
    const update = () => { setOnline(navigator.onLine); setNow(Date.now()) }
    update()
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      operation.current++
      WebAuthnAbortService.cancelCeremony()
      window.clearInterval(timer)
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => { focusTarget.current?.focus() }, [request])
  useEffect(() => { enrollmentHeading.current?.focus() }, [household])
  useEffect(() => {
    // Header can sign out while optional setup is open. Do not leave that
    // installation showing authenticated enrollment after context refreshes.
    if (hadSession.current && !session) {
      operation.current++
      WebAuthnAbortService.cancelCeremony()
      locked.current = false
      setHousehold(null)
      setRequest(null)
      setCode('')
      setOptions(null)
      setBusy(false)
      setCanCancel(false)
      setError(null)
    }
    hadSession.current = !!session
  }, [session])

  const begin = () => {
    if (locked.current) return null
    locked.current = true
    setBusy(true)
    setError(null)
    return ++operation.current
  }
  const end = (id: number) => {
    if (id !== operation.current) return
    locked.current = false
    setBusy(false)
    setCanCancel(false)
  }
  const cancelPasskey = () => {
    operation.current++
    WebAuthnAbortService.cancelCeremony()
    locked.current = false
    setBusy(false)
    setCanCancel(false)
    setOptions(null)
    setError(null)
  }
  const destination = (hasHousehold: boolean) => router.navigate(resolvePostAuthDestination({ ...search, hasHousehold }))

  const sendCode = async (event?: React.FormEvent) => {
    event?.preventDefault()
    const parsed = requestEmailCodeSchema.safeParse({ email, ...search })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Enter a valid email address.')
      return
    }
    const id = begin()
    if (id === null) return
    try {
      const result = await login({ data: parsed.data })
      if (id !== operation.current) return
      if (result.status === 'sent') {
        setEmail(parsed.data.email)
        setRequest(result)
        setRetryAt(result.resendAt)
        setCode('')
      } else if (result.status === 'rate_limited' || result.status === 'delivery_failed') {
        setRetryAt(Date.now() + result.retryAfter * 1000)
        setError(result.status === 'rate_limited' ? 'Too many code requests. Wait before trying again.' : 'We could not deliver your code. Check your email address and try again.')
      } else {
        setError(result.status === 'admission_denied' ? 'This email is not eligible to sign in. Try another email address.' : 'Enter a valid email address.')
      }
    } catch {
      if (id === operation.current) setError('Could not request a code. Check your connection and try again.')
    } finally { end(id) }
  }

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!request) return
    const id = begin()
    if (id === null) return
    try {
      const result = await verify({ data: { requestId: request.requestId, code } })
      if (id !== operation.current) return
      if (result.status === 'authenticated') {
        // Refresh session context in-place; root keeps this Outlet mounted.
        setHousehold(result.hasHousehold)
        setOptions(null)
        await router.invalidate({ sync: true })
      } else {
        const messages = {
          invalid: `That code is not correct.${result.status === 'invalid' && result.attemptsRemaining !== undefined ? ` ${result.attemptsRemaining} attempts remaining.` : ''} Try again or request a new code.`,
          expired: 'That code has expired. Request a new code.',
          consumed: 'That code has already been used or replaced. Request a new code.',
          attempt_limit: 'Too many incorrect attempts. Request a new code.',
          admission_denied: 'This email is no longer eligible to sign in. Try another email address.',
          ambiguous_identity: 'We could not identify a unique account for this email. Contact the household owner before trying another email.',
        }
        setError(messages[result.status])
      }
    } catch {
      if (id === operation.current) setError('Could not complete sign-in. Check your connection and try again.')
    } finally { end(id) }
  }

  const preparePasskey = async () => {
    const id = begin()
    if (id === null) return
    setCanCancel(true)
    try {
      if (household !== null) {
        const data = await beginRegistration()
        if (id !== operation.current) return
        if (data.status === 'options') setOptions({ kind: 'registration', data })
        else setError('Passkey setup is unavailable. You can continue without a passkey.')
      } else {
        const data = await beginAuthentication()
        if (id === operation.current) setOptions({ kind: 'authentication', data })
      }
    } catch {
      if (id === operation.current) setError(household !== null ? 'Passkey setup is unavailable. You are still signed in; continue without a passkey.' : 'Passkey sign-in is unavailable. Use an email code instead.')
    } finally { end(id) }
  }

  // Options are ready before this gesture: Safari need not retain activation
  // across the server-function request. No prompt opens automatically.
  const usePasskey = async () => {
    if (!options) return
    const id = begin()
    if (id === null) return
    setCanCancel(true)
    try {
      if (options.kind === 'registration') {
        const response = await startRegistration({ optionsJSON: options.data.optionsJSON })
        if (id !== operation.current) return
        setCanCancel(false)
        const result = await finishRegistration({ data: { requestId: options.data.requestId, response } })
        if (id !== operation.current) return
        if (result.status === 'registered') await destination(household!)
        else setError('Passkey setup did not finish. You are still signed in; continue without a passkey.')
      } else {
        const response = await startAuthentication({ optionsJSON: options.data.optionsJSON })
        if (id !== operation.current) return
        setCanCancel(false)
        const result = await finishAuthentication({ data: { requestId: options.data.requestId, response } })
        if (id !== operation.current) return
        if (result.status === 'authenticated') {
          await router.invalidate({ sync: true })
          if (id === operation.current) await destination(result.hasHousehold)
        } else setError(result.status === 'admission_denied' ? 'This account is not eligible to sign in. You can try an email code.' : 'Passkey sign-in did not finish. Use an email code instead.')
      }
    } catch {
      if (id === operation.current) setError(household !== null ? 'Passkey setup was cancelled or could not finish. You are still signed in; continue without a passkey.' : 'Passkey sign-in was cancelled or could not finish. Use an email code instead.')
    } finally {
      if (id === operation.current) setOptions(null)
      end(id)
    }
  }

  const wait = Math.max(0, Math.ceil((retryAt - now) / 1000))
  return (
    <main id="main-content" className={styles.page}>
      <div className={`${clay.card} ${styles.cardContent}`}>
        <h1 className={`${clay.puffyText} ${styles.title}`}>Welcome Home! 🥚</h1>
        {!online && <p role="status" className={styles.hint}>Sign-in needs an internet connection. Reconnect and continue here—no need to reinstall.</p>}
        {household !== null ? (
          <section className={styles.form} aria-label="Optional passkey setup">
            <h2 ref={enrollmentHeading} tabIndex={-1}>You’re signed in</h2>
            <p>Next time, a passkey can sign you in with your device. Setup is optional; email codes will still work.</p>
            {supported && !options && <button className={clay.button} disabled={busy || !online} onClick={preparePasskey}>Set up passkey</button>}
            {options && <button className={clay.button} disabled={busy || !online} onClick={usePasskey}>Create passkey on this device</button>}
            <button className={clay.button} disabled={busy && !canCancel} onClick={() => { cancelPasskey(); void destination(household) }}>Continue without a passkey</button>
          </section>
        ) : (
          <>
            {!options && <form className={styles.form} noValidate onSubmit={request ? verifyCode : sendCode}>
              {request ? <>
                <p id="code-hint">Enter the code sent to <strong>{email}</strong>. Read your email, then return to this app.</p>
                <label htmlFor="sign-in-code" className={styles.label}>Six-digit code</label>
                <input ref={focusTarget} id="sign-in-code" className={`${clay.input} ${styles.code}`} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-describedby="code-hint" required disabled={busy} />
                <p className={styles.hint}>{now >= request.expiresAt ? 'Your code has expired. Request a new code.' : 'The code expires 10 minutes after it was sent.'}</p>
                <button className={clay.button} disabled={busy || !online || code.length !== 6}>Verify code</button>
                <button type="button" className={clay.button} disabled={busy || !online || wait > 0} onClick={() => void sendCode()}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
                <button type="button" className={clay.button} disabled={busy} onClick={() => { setRequest(null); setCode(''); setError(null); setRetryAt(0) }}>Change email</button>
              </> : <>
                <p>Sign in here to reconnect to your household list.</p>
                <label htmlFor="sign-in-email" className={styles.label}>Your email</label>
                <input ref={focusTarget} id="sign-in-email" type="email" autoComplete="email" className={clay.input} placeholder="eggs@family.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
                <button className={clay.button} disabled={busy || !online || wait > 0}>{wait > 0 ? `Send code in ${wait}s` : 'Send email code'}</button>
              </>}
            </form>}
            {supported && !options && !request && <button className={`${clay.button} ${styles.passkey}`} disabled={busy || !online} onClick={preparePasskey}>Sign in with a passkey</button>}
            {options && <div className={styles.form}>
              <p>Your device is ready to check for a passkey.</p>
              <button className={clay.button} disabled={busy || !online} onClick={usePasskey}>Use device passkey</button>
              <button className={clay.button} disabled={busy && !canCancel} onClick={cancelPasskey}>Use email code instead</button>
            </div>}
            {canCancel && !options && <button className={clay.button} onClick={cancelPasskey}>Use email code instead</button>}
          </>
        )}
        {busy && <p role="status" className={styles.hint}>Please wait…</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
    </main>
  )
}
