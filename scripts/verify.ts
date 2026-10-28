import { spawn } from 'node:child_process'
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

type CommandOptions = { cwd: string; env: NodeJS.ProcessEnv }

export function runCommand(args: string[], options: CommandOptions): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), { ...options, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
}

/** Bun 1.3.11 (the Docker runtime). Example:
 * AUTH_TEST_DATABASE_URL=postgres://verify:verify@localhost:5432/verify bun run verify
 * The database must be disposable. No checkout dotenv files or caller app secrets are used.
 */
export async function verify({
  env = process.env,
  cwd = dirname(dirname(fileURLToPath(import.meta.url))),
  runtime = process.execPath,
  run = runCommand,
}: {
  env?: NodeJS.ProcessEnv
  cwd?: string
  runtime?: string
  run?: typeof runCommand
} = {}): Promise<number> {
  const database = env.AUTH_TEST_DATABASE_URL
  if (!database?.trim()) throw new Error('AUTH_TEST_DATABASE_URL must explicitly name a disposable Postgres database; no DATABASE_URL fallback')

  const childEnv: NodeJS.ProcessEnv = {}
  for (const key of ['PATH', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'LANG', 'LC_ALL', 'TERM']) {
    if (env[key] !== undefined) childEnv[key] = env[key]
  }
  Object.assign(childEnv, {
    NODE_ENV: 'production',
    AUTH_TEST_DATABASE_URL: database,
    DATABASE_URL: database,
    AUTH_SECRET: 'disposable-verification-only-secret-32-characters',
    BASE_URL: 'https://example.test',
    AUTH_WHITELIST: 'verify@example.test',
    AUTH_PASSPHRASE: 'disposable-verification-passphrase',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1',
    SMTP_USER: 'disposable-smtp-mock',
    SMTP_PASS: 'disposable-smtp-mock',
    EMAIL_FROM: 'Verification <verify@example.test>',
    VERIFY_BUN_RUNTIME: runtime,
  })

  const root = await mkdtemp(join(tmpdir(), 'eggspedition-verify-'))
  try {
    // Varlock's relative generateTypes output stays here, never in the checkout.
    await copyFile(join(cwd, '.env.schema'), join(root, '.env.schema'))
    const config = join(root, 'vite.config.mjs')
    await writeFile(config, `export { createVerificationConfig as default } from ${JSON.stringify(join(cwd, 'vite.config.ts'))};\n`)
    const stages: [string, string[]][] = [
      ['build', [join(cwd, 'node_modules/vite/bin/vite.js'), 'build', '--config', config]],
      ['typecheck', [join(cwd, 'node_modules/typescript/bin/tsc'), '--noEmit']],
      ['test', [join(cwd, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config]],
      ['icons:check', [join(cwd, 'scripts/check-icons.ts')]],
      ['passkey smoke', [join(cwd, 'scripts/auth-passkey-smoke.ts'), '--production']],
    ]
    for (const [name, args] of stages) {
      console.log(`[verify] ${name}`)
      try {
        // React tests need development APIs; the schema does not accept NODE_ENV=test.
        const code = await run([
          runtime, '--no-env-file', join(cwd, 'node_modules/varlock/bin/cli.js'), 'run', '--path', root, '--no-redact-stdout',
          '--', ...(name === 'test' ? ['node'] : [runtime, '--no-env-file']), ...args,
        ], { cwd, env: { ...childEnv, NODE_ENV: name === 'test' ? 'development' : 'production' } })
        if (code !== 0) {
          console.error(`[verify] ${name} failed (exit ${code})`)
          return code
        }
      } catch (error) {
        console.error(`[verify] ${name} failed to launch`)
        throw error
      }
    }
    return 0
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  verify().then((code) => { process.exitCode = code }, (error) => {
    console.error(error)
    process.exitCode = 1
  })
}
