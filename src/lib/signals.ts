import { EventEmitter } from 'node:events'

export const signalEmitter = new EventEmitter()

export function notifyHousehold(householdId: string, action: string) {
  signalEmitter.emit('household-signal', { householdId, action })
}
