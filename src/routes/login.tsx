import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { loginServerFn } from '../services/auth.api'
import clay from '../styles/clay.module.css'
import utils from '../styles/utils.module.css'

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
    <div className={`${utils.flex} ${utils.justifyCenter} ${utils.itemsCenter}`} style={{ minHeight: '100vh', backgroundColor: 'var(--clay-bg)' }}>
      <div className={clay.card} style={{ maxWidth: '400px', width: '90%' }}>
        <h1 className={`${clay.puffyText} ${utils.textCenter} ${utils.mb4}`}>
          Welcome Home! 🥚
        </h1>
        
        {sent ? (
          <div className={utils.textCenter}>
            <p className={clay.puffyText}>
              We've sent a squishy magic link to <strong>{email}</strong>.
            </p>
            <p className={`${utils.textSm} ${utils.mt4}`} style={{ color: '#888' }}>
              (Check your console in dev mode!)
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={`${utils.flex} ${utils.flexCol} ${utils.gap4}`}>
            <label className={`${clay.puffyText} ${utils.textSm} ${utils.ml2}`}>
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
            {error && <p className={`${utils.textXs} ${utils.ml2}`} style={{ color: 'red' }}>{error}</p>}
            <button type="submit" className={`${clay.button} ${utils.mt4}`}>
              Send Magic Link
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
