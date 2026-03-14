import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { loginServerFn } from '../services/auth.api'
import clay from '../styles/clay.module.css'
import { z } from 'zod'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: search.returnTo as string | undefined,
    name: search.name as string | undefined,
    quantity: search.quantity as string | undefined,
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
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      backgroundColor: 'var(--clay-bg)' 
    }}>
      <div className={clay.card} style={{ maxWidth: '400px', width: '90%' }}>
        <h1 className={clay.puffyText} style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          Welcome Home! 🥚
        </h1>
        
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <p className={clay.puffyText}>
              We've sent a squishy magic link to <strong>{email}</strong>.
            </p>
            <p style={{ fontSize: '0.9rem', marginTop: '1rem', color: '#888' }}>
              (Check your console in dev mode!)
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label className={clay.puffyText} style={{ fontSize: '0.9rem', marginLeft: '0.5rem' }}>
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
            {error && <p style={{ color: 'red', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{error}</p>}
            <button type="submit" className={clay.button} style={{ marginTop: '1rem' }}>
              Send Magic Link
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
