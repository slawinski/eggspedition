import { EventEmitter } from 'node:events'
import { queryClient } from '../db'

export const signalEmitter = new EventEmitter()

// Listen for Postgres NOTIFY events
async function setupPostgresListener() {
  console.log('[Signals] Setting up Postgres listener...')
  try {
    await queryClient.listen('household_update', (payload) => {
      try {
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload
        console.log(`[Postgres Signal] Processed for household: ${data.householdId} action: ${data.action}`)
        signalEmitter.emit('household-signal', data)
      } catch (err) {
        console.error('[Postgres Signal] Error handling payload:', err)
        console.error('[Postgres Signal] Raw payload:', payload)
      }
    })
    console.log('[Signals] Postgres listener active.')
  } catch (err) {
    console.error('[Signals] Failed to start Postgres listener:', err)
    // Retry after delay
    setTimeout(setupPostgresListener, 5000)
  }
}

// In development, the module might be re-loaded. 
// We want to ensure we don't have multiple listeners if possible, 
// but postgres.js .listen handles some of this.
setupPostgresListener()

export async function notifyHousehold(householdId: string, action: string) {
  const payload = JSON.stringify({ householdId, action })
  console.log(`[Signals] Notifying household ${householdId} via Postgres...`)
  // Using SELECT pg_notify is the most compatible way to send payloads
  await queryClient`SELECT pg_notify('household_update', ${payload})`
}
