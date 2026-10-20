import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import * as schema from '../db/schema'

/** Never imports the application DB or loads .env. Each suite owns a disposable schema. */
export async function createAuthTestDatabase() {
  const url = process.env.AUTH_TEST_DATABASE_URL
  if (!url) throw new Error('AUTH_TEST_DATABASE_URL must explicitly name a disposable Postgres database; no DATABASE_URL fallback')
  const namespace = `auth_test_${randomUUID().replaceAll('-', '')}`
  const admin = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => {} })
  const first = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => {}, connection: { search_path: namespace } })
  const second = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => {}, connection: { search_path: namespace } })
  async function close() {
    await Promise.all([first.end(), second.end()])
    try { await admin.unsafe(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`) }
    finally { await admin.end() }
  }
  try {
    await admin.unsafe(`CREATE SCHEMA "${namespace}"`)
    const empty = generateDrizzleJson({})
    // Explicit pre-auth baseline: future schema exports automatically join addAuthTables,
    // while addSessions must continue proving the U1-only additive migration.
    const legacyNames = new Set(['users', 'households', 'memberships', 'magicLinks', 'categories', 'stores', 'groceryItems', 'householdLogs', 'invites', 'appliedOperations'])
    const legacyExports = Object.fromEntries(Object.entries(schema).filter(([key]) => legacyNames.has(key)))
    const legacy = generateDrizzleJson(legacyExports)
    let applied = legacy
    let appliedExports: Record<string, unknown> = legacyExports
    async function apply(statements: string[]) {
      for (const statement of statements) {
        await first.unsafe(statement.replaceAll('"public".', `"${namespace}".`))
      }
    }
    async function addTables(additions: Record<string, unknown>) {
      const nextExports = { ...appliedExports, ...additions }
      const next = generateDrizzleJson(nextExports)
      await apply(await generateMigration(applied, next))
      applied = next
      appliedExports = nextExports
    }
    await apply(await generateMigration(empty, legacy))
    return {
      db: drizzle(first, { schema }),
      otherDb: drizzle(second, { schema }),
      first, second,
      async addSessions() { await addTables({ authSessions: schema.authSessions }) },
      async addAuthTables() { await addTables(schema) },
      close,
    }
  } catch (error) {
    await close()
    throw error
  }
}

export type AuthTestDatabase = Awaited<ReturnType<typeof createAuthTestDatabase>>
