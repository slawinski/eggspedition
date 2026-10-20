export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Resolve only after the controlling worker has removed cached HTML. */
export async function clearAuthNavigations(): Promise<'reload' | void> {
  if (!('serviceWorker' in navigator)) return
  const worker = navigator.serviceWorker.controller
  if (!worker) return
  try {
    await new Promise<void>((resolve, reject) => {
      const channel = new MessageChannel()
      const finish = (success: boolean) => {
        clearTimeout(timer)
        channel.port1.close()
        if (success) resolve()
        else reject(new Error('Could not clear offline sign-in pages.'))
      }
      const timer = setTimeout(() => finish(false), 3000)
      channel.port1.onmessage = ({ data }) => finish(data?.type === 'auth-navigations-cleared')
      try { worker.postMessage({ type: 'clear-auth-navigations' }, [channel.port2]) }
      catch { finish(false) }
    })
  } catch {
    // A v2 controller cannot acknowledge the new protocol. Retire it before
    // leaving this document; the next navigation must not use that old worker.
    const registration = await navigator.serviceWorker.getRegistration()
    await registration?.unregister()
    if ('caches' in globalThis) {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name.startsWith('eggspedition-')).map((name) => caches.delete(name)))
    }
    return 'reload'
  }
}
