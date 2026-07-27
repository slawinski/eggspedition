import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/quick-add')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({
        to: '/login',
        replace: true,
      })
    }

    throw redirect({
      to: '/',
      search: { add: 'item' },
      replace: true,
    })
  },
})
