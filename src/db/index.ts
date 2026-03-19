import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  console.warn('--- [DB MODE] DATABASE_URL is missing. DB operations will fail! ---')
}

export const queryClient = postgres(process.env.DATABASE_URL || 'postgres://localhost:5432/eggspedition')
export const db = drizzle(queryClient, { schema })
