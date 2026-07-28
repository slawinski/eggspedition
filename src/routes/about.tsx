import { createFileRoute } from '@tanstack/react-router'
import styles from './about.module.css'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main id="main-content" className={styles.container}>
      <section className={`island-shell ${styles.shell}`}>
        <p className={styles.kicker}>About</p>
        <h1 className={`display-title ${styles.title}`}>About Eggspedition</h1>
        <p className={styles.description}>
          A shared grocery list designed for families and households. Fast to
          use in the store, easy to manage at home.
        </p>
        <hr className={styles.divider} />
        <div className={styles.meta}>
          <p className={styles.metaLine}>
            Created by{' '}
            <a
              href="https://psla.dev"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              psla
            </a>
          </p>
          <p className={styles.metaLine}>
            Eggspedition does not collect, share, or sell any personal data.
            Your grocery list stays with your household.
          </p>
          <p className={styles.metaLine}>Version 1.0</p>
        </div>
      </section>
    </main>
  )
}
