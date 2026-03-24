import { createFileRoute } from '@tanstack/react-router'
import utils from '../styles/utils.module.css'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className={`${utils.pageWrap} ${utils.px4} ${utils.py12}`}>
      <section className={`island-shell ${utils.rounded2xl} ${utils.p6} ${utils.smP5}`}>
        <p className={`${utils.islandKicker} ${utils.mb1}`}>About</p>
        <h1 className={`display-title ${utils.mb3} ${utils.fontBold}`} style={{ fontSize: 'min(3rem, 10vw)', color: 'var(--sea-ink)' }}>
          A small starter with room to grow.
        </h1>
        <p className={`${utils.m0}`} style={{ maxWidth: '48rem', fontSize: '1rem', lineHeight: '2', color: 'var(--sea-ink-soft)' }}>
          TanStack Start gives you type-safe routing, server functions, and
          modern SSR defaults. Use this as a clean foundation, then layer in
          your own routes, styling, and add-ons.
        </p>
      </section>
    </main>
  )
}
