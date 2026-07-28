/**
 * Accessible live-region announcer for Quick Add repeat-to-increment.
 *
 * Creates a visually hidden but screen-reader-visible element that announces
 * quantity changes. Announcements are debounced so rapid taps don't flood
 * the screen reader (every frame is too much; ~300 ms is a practical floor).
 *
 * Usage:
 *   const announcer = createQuickAddAnnouncer()
 *   announcer.announceDebounced("Coffee x3 added to list")
 *   // later, when the component unmounts:
 *   announcer.destroy()
 */

let liveRegionCounter = 0

export interface QuickAddAnnouncer {
  /** Announce immediately (use for one-off confirmations). */
  announce: (message: string) => void
  /**
   * Announce with debouncing. Rapid calls within `delayMs` only produce one
   * announcement. Useful for repeat-to-increment where the user may tap
   * several times in quick succession.
   */
  announceDebounced: (message: string, delayMs?: number) => void
  /** Remove the live region from the DOM and cancel pending timers. */
  destroy: () => void
}

export function createQuickAddAnnouncer(): QuickAddAnnouncer {
  const id = `quick-add-live-${++liveRegionCounter}`

  // Check if a region already exists (singleton-ish per page)
  let region = document.getElementById(id)
  if (!region) {
    region = document.createElement('div')
    region.id = id
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
    region.style.cssText =
      'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;'
    document.body.appendChild(region)
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let lastAnnounced = ''

  function announce(message: string) {
    if (!region || message === lastAnnounced) return
    lastAnnounced = message
    // Clear and re-set to force re-announcement even if the text is the same
    region.textContent = ''
    // Use a microtask to force the DOM to register the clear
    requestAnimationFrame(() => {
      if (region) {
        region.textContent = message
      }
    })
  }

  function announceDebounced(message: string, delayMs = 300) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      announce(message)
      debounceTimer = null
    }, delayMs)
  }

  function destroy() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (region && region.parentNode) {
      region.parentNode.removeChild(region)
    }
  }

  return { announce, announceDebounced, destroy }
}
