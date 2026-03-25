import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { loginServerFn } from '../services/auth.api'
import clay from '../styles/clay.module.css'
import styles from './login.module.css'

import { z } from 'zod'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    returnTo: z.string().optional(),
    name: z.string().optional(),
    quantity: z.string().optional(),
  }),
  component: LoginComponent,
})

function LoginComponent() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const search = Route.useSearch()
  
  const login = useServerFn(loginServerFn)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    try {
      await login({ 
        data: { 
          email, 
          returnTo: search.returnTo,
          name: search.name,
          quantity: search.quantity
        } 
      })
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className={styles.page}>
      <div className={`${clay.card} ${styles.cardContent}`}>
        <h1 className={`${clay.puffyText} ${styles.title}`}>
          Welcome Home! 🥚
        </h1>
        
        {sent ? (
          <div className={styles.successMessage}>
            <p className={clay.puffyText}>
              We've sent a squishy magic link to <strong>{email}</strong>.
            </p>
            <p className={styles.hint}>
              (Check your console in dev mode!)
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={`${clay.puffyText} ${styles.label}`}>
              Your Email
            </label>
            <input
              type="email"
              className={clay.input}
              placeholder="eggs@family.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={`${clay.button} ${styles.hint}`} style={{ marginTop: '1rem' }}>
              Send Magic Link
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
