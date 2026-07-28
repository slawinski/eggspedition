import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * DEPRECATED — `/quick-add` is a legacy convenience route.
 *
 * It redirects to `/?add=item` so that pressing the Quick Add FAB always
 * opens the Add Item sheet in the main list context. This route exists
 * only for backward-compatibility with old bookmarks and deep links.
 *
 * Any additional query params (name, quantity, category, store) are
 * forwarded to the target so that pre-filled item data is preserved.
 */

export const Route = createFileRoute('/quick-add')({
  beforeLoad: ({ context, search }) => {
    if (!context.session) {
      throw redirect({
        to: '/login',
        replace: true,
      })
    }

    // Preserve any incoming query params when redirecting to /?add=item
    const { ...rest } = search as Record<string, unknown>
    throw redirect({
      to: '/',
      search: { add: 'item' as const, ...rest },
      replace: true,
    })
  },
})
