import { Link } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import styles from './NotFound.module.css'

interface NotFoundProps {
  /** When true, renders "Go to list" link text. Otherwise "Go home". */
  isLoggedIn?: boolean
}

/**
 * NotFound — Clay-styled 404 page displayed when a route is not found.
 *
 * Centred clay card with a SearchX icon, title, body, and a session-aware
 * primary link back to the home/grocery list route.
 */
export default function NotFound({ isLoggedIn = false }: NotFoundProps) {
  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">
          <SearchX size={28} />
        </div>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.body}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className={styles.action}>
          {isLoggedIn ? 'Go to list' : 'Go home'}
        </Link>
      </div>
    </main>
  )
}
