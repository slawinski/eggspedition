import { EventEmitter } from 'node:events'
import { queryClient } from '../db'

export const signalEmitter = new EventEmitter()

// Listen for Postgres NOTIFY events
// This allows multiple server instances (e.g. port 3000 and 3001) to sync
async function setupPostgresListener() {
  await queryClient.listen('household_update', (payload) => {
    try {
      const data = JSON.parse(payload)
      console.log(`[Postgres Signal] Received for household: ${data.householdId}`)
      signalEmitter.emit('household-signal', data)
    } catch (err) {
      console.error('[Postgres Signal] Failed to parse payload:', payload)
    }
  })
}

setupPostgresListener().catch(console.error)

export async function notifyHousehold(householdId: string, action: string) {
  // Use Postgres NOTIFY to broadcast to all server instances
  const payload = JSON.stringify({ householdId, action })
  await queryClient`NOTIFY household_update, ${payload}`
}
