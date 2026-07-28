/** ─── Return Intent Validation ───
 * Security-focused helpers for `returnTo` deep-link params.
 * Rejects absolute URLs, protocol-relative URLs, and anything not
 * starting with `/` to prevent open-redirect attacks.
 */

/**
 * Validates a `returnTo` parameter for safe redirect.
 * Returns the cleaned path if valid, or `undefined` if rejected.
 *
 * Rejects:
 *  - Absolute URLs (http://, https://, //evil.com)
 *  - Protocol-relative URLs
 *  - Anything not starting with `/`
 *  - Strings with embedded newlines
 */
export function validateReturnTo(raw: string | undefined): string | undefined {
  if (!raw) return undefined

  // Reject anything with newlines (header injection)
  if (raw.includes('\n') || raw.includes('\r')) return undefined

  // Must start with `/`
  if (!raw.startsWith('/')) return undefined

  // Reject protocol-relative URLs (//evil.com)
  if (raw.startsWith('//')) return undefined

  // Remove any query string for the protocol check on the path portion
  const pathOnly = raw.split('?')[0]
  if (pathOnly.startsWith('http:') || pathOnly.startsWith('https:')) return undefined

  return raw
}

/**
 * Builds a URL with search params preserved.
 * Combines a validated returnTo path with optional query parameters.
 * Only includes params that have defined, non-empty values.
 */
export function buildReturnUrl(
  returnTo: string,
  params: Record<string, string | undefined>
): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, value)
    }
  }

  const queryString = searchParams.toString()
  return queryString ? `${returnTo}?${queryString}` : returnTo
}
