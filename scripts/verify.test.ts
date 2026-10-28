import { mkdtemp, readFile, rm, writeFile, access, symlink, copyFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { runCommand, verify } from './verify'

const database = 'postgres://verify:disposable@localhost:5432/verify'
const directories: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function checkout() {
  const cwd = await mkdtemp(join(tmpdir(), 'verify-test-'))
  directories.push(cwd)
  await writeFile(join(cwd, '.env.schema'), '# @generateTypes(lang=\'ts\', path=\'env.d.ts\')\n# ---\nDATABASE_URL=\n')
  return cwd
}

it('requires an explicit disposable URL before launching any command', async () => {
  const run = vi.fn()
  await expect(verify({ env: { DATABASE_URL: database }, run })).rejects.toThrow('AUTH_TEST_DATABASE_URL')
  expect(run).not.toHaveBeenCalled()
})

it('runs every selected check in order with isolated configuration and explicit runtime', async () => {
  const cwd = await checkout()
  const run = vi.fn(async (args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => {
    expect(options.cwd).toBe(cwd)
    expect(options.env).toMatchObject({ PATH: '/essential/bin', AUTH_TEST_DATABASE_URL: database,
      DATABASE_URL: database, NODE_ENV: args.some((arg) => arg.endsWith('/vitest.mjs')) ? 'development' : 'production', SMTP_HOST: '127.0.0.1' })
    expect(options.env.AUTH_SECRET).not.toBe('production-signing-key')
    expect(options.env.SMTP_PASS).not.toBe('production-mail-password')
    for (const key of ['HOME', 'NODE_OPTIONS', 'BUN_OPTIONS', 'VITE_PRIVATE_TOKEN', 'DEPLOY_TOKEN']) {
      expect(options.env[key]).toBeUndefined()
    }
    expect(args.slice(0, 3)).toEqual(['/pinned/bun', '--no-env-file', join(cwd, 'node_modules/varlock/bin/cli.js')])
    const root = args[args.indexOf('--path') + 1]
    expect(root).not.toBe(cwd)
    expect(await readFile(join(root, '.env.schema'), 'utf8')).toContain('@generateTypes')
    if (args.includes('--config')) {
      expect(await readFile(args[args.indexOf('--config') + 1], 'utf8')).toContain('createVerificationConfig as default')
    }
    expect(args.slice(args.indexOf('--') + 1, args.indexOf('--') + (options.env.NODE_ENV === 'development' ? 2 : 3)))
      .toEqual(options.env.NODE_ENV === 'development' ? ['node'] : ['/pinned/bun', '--no-env-file'])
    return 0
  })
  expect(await verify({ cwd, runtime: '/pinned/bun', run, env: {
    AUTH_TEST_DATABASE_URL: database, PATH: '/essential/bin', HOME: '/private/home',
    DATABASE_URL: 'postgres://production', AUTH_SECRET: 'production-signing-key',
    SMTP_PASS: 'production-mail-password', NODE_OPTIONS: '--require=secret', BUN_OPTIONS: '--preload=secret',
    VITE_PRIVATE_TOKEN: 'secret', DEPLOY_TOKEN: 'secret',
  } })).toBe(0)
  const commands = run.mock.calls.map(([args, options]) => args.slice(args.indexOf('--') + (options.env.NODE_ENV === 'development' ? 2 : 3)))
  expect(commands[0]).toEqual([join(cwd, 'node_modules/vite/bin/vite.js'), 'build', '--config', expect.any(String)])
  expect(commands[1]).toEqual([join(cwd, 'node_modules/typescript/bin/tsc'), '--noEmit'])
  expect(commands[2]).toEqual([join(cwd, 'node_modules/vitest/vitest.mjs'), 'run', '--config', expect.any(String)])
  expect(commands[3]).toEqual([join(cwd, 'scripts/check-icons.ts')])
  expect(commands[4]).toEqual([join(cwd, 'scripts/auth-passkey-smoke.ts'), '--production'])
  expect(commands).toHaveLength(5)
  const root = run.mock.calls[0][0][5]
  await expect(access(root)).rejects.toThrow()
})

it.each([0, 1, 2, 3, 4])('stops at failed stage %i, reports it, preserves exit status and removes temporary files', async (failure) => {
  const cwd = await checkout()
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  let calls = 0
  const run = vi.fn(async (args: string[]) => {
    calls++
    directories.push(args[5])
    return calls === failure + 1 ? 23 : 0
  })
  expect(await verify({ cwd, env: { AUTH_TEST_DATABASE_URL: database }, run })).toBe(23)
  expect(run).toHaveBeenCalledTimes(failure + 1)
  expect(error).toHaveBeenCalledWith(expect.stringContaining(['build', 'typecheck', 'test', 'icons:check', 'passkey smoke'][failure]))
  await expect(access(run.mock.calls[0][0][5])).rejects.toThrow()
})

it('reports launch errors and cleans up without continuing to later stages', async () => {
  const cwd = await checkout()
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  let root = ''
  const run = vi.fn(async (args: string[]) => {
    root = args[5]
    throw new Error('spawn failed')
  })
  await expect(verify({ cwd, env: { AUTH_TEST_DATABASE_URL: database }, run })).rejects.toThrow('spawn failed')
  expect(run).toHaveBeenCalledTimes(1)
  expect(error).toHaveBeenCalledWith('[verify] build failed to launch')
  await expect(access(root)).rejects.toThrow()
})

it('runs a real fresh child with only the supplied environment and propagates its nonzero exit', async () => {
  const cwd = await checkout()
  await writeFile(join(cwd, '.env'), 'VERIFY_CHECKOUT_SECRET=do-not-load\n')
  const script = join(cwd, 'child.ts')
  await writeFile(script, `if (process.env.VERIFY_CHECKOUT_SECRET || process.env.AUTH_SECRET || process.env.DATABASE_URL) process.exit(90); process.exit(19)`)
  expect(await runCommand([process.env.VERIFY_BUN_RUNTIME ?? 'bun', '--no-env-file', script], { cwd, env: {} })).toBe(19)
})

it.each([
  { command: 'build', mode: 'production', isolated: true },
  { command: 'serve', mode: 'development', isolated: true },
  { command: 'serve', mode: 'test', isolated: true },
  { command: 'build', mode: 'production', isolated: false },
  { command: 'serve', mode: 'development', isolated: false },
] as const)('checks real app/Nitro dotenv isolation=$isolated during $command ($mode)', async ({ command, mode, isolated }) => {
  const cwd = await checkout()
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(cwd, 'node_modules'), 'dir')
  await copyFile(fileURLToPath(new URL('../vite.config.ts', import.meta.url)), join(cwd, 'vite.config.ts'))
  await writeFile(join(cwd, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }))
  await mkdir(join(cwd, 'src/routes'), { recursive: true })
  await writeFile(join(cwd, 'src/routes/__root.tsx'), 'export const Route = {}')
  await writeFile(join(cwd, 'src/router.ts'), 'export const getRouter = () => ({})')
  // build:before runs inside the real Nitro Vite initialization hook, not just the config factory.
  await writeFile(join(cwd, 'nitro.config.mjs'), `export default {
    hooks: { 'build:before': (nitro) => { globalThis.__verifyNitro = nitro; } }
  }`)
  // Only synthetic fixtures are read by the test. The actual checkout dotenv files are never loaded.
  await writeFile(join(cwd, '.env'), 'VERIFY_CHECKOUT_SECRET=secret\nVITE_PRIVATE_TOKEN=secret\nDATABASE_URL=postgres://production\n')
  for (const suffix of ['local', 'production', 'production.local', 'development', 'development.local', 'test', 'test.local']) {
    await writeFile(join(cwd, `.env.${suffix}`), `VERIFY_${suffix.replaceAll('.', '_').toUpperCase()}_SECRET=secret\nVITE_${suffix.replaceAll('.', '_').toUpperCase()}_SECRET=secret\n`)
  }
  const run = vi.fn(async (args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => {
    const root = args[5]
    const config = args[args.indexOf('--config') + 1]
    if (!isolated) {
      // Control: ordinary dev/build must still load the synthetic checkout dotenv.
      await writeFile(config, `export { default } from ${JSON.stringify(join(cwd, 'vite.config.ts'))};\n`)
    }
    const probe = join(cwd, 'probe.mjs')
    await writeFile(probe, `
      import assert from 'node:assert/strict';
      import { resolveConfig } from 'vite';
      assert.equal(process.env.DATABASE_URL, ${JSON.stringify(database)});
      assert.equal(process.env.VERIFY_CHECKOUT_SECRET, undefined);
      const config = await resolveConfig({ root: ${JSON.stringify(cwd)}, configFile: ${JSON.stringify(config)} }, ${JSON.stringify(command)}, ${JSON.stringify(mode)});
      const nitro = globalThis.__verifyNitro;
      assert.ok(nitro, 'Nitro Vite build:before hook must actually run');
      assert.equal(nitro.options.dev, ${command === 'serve'});
      assert.equal(nitro.options.builder, 'vite');
      assert.equal(nitro.options.preset, ${JSON.stringify(command === 'build' ? 'bun' : 'nitro-dev')});
      const reflect = nitro.options.moduleSideEffects.find(path => path.endsWith('/node_modules/reflect-metadata/'));
      assert.ok(reflect);
      assert.ok(config.environments.nitro, 'Nitro environment hook must actually run');
      const server = config.environments.nitro;
      assert.equal(server.build.rollupOptions.treeshake.moduleSideEffects(reflect + 'Reflect.js'), true);
      if (${command === 'build'}) {
        assert.equal(server.resolve.noExternal, true, 'production server must remain bundled');
        assert.equal(server.define['process.env.NODE_ENV'], '"production"');
        assert.equal(server.build.rollupOptions.output.entryFileNames, 'index.mjs');
      }
      assert.equal(config.css.modules.generateScopedName, '[name]_[local]');
      assert.ok(config.plugins.some((plugin) => plugin.name.includes('tanstack')));
      assert.equal(process.env.DATABASE_URL, ${JSON.stringify(database)});
      for (const key of ['VERIFY_CHECKOUT_SECRET', 'VITE_PRIVATE_TOKEN',
        ...['LOCAL', 'PRODUCTION', 'PRODUCTION_LOCAL', 'DEVELOPMENT', 'DEVELOPMENT_LOCAL', 'TEST', 'TEST_LOCAL'].flatMap(suffix => ['VERIFY_' + suffix + '_SECRET', 'VITE_' + suffix + '_SECRET'])]) {
        const active = ['VERIFY_CHECKOUT_SECRET', 'VITE_PRIVATE_TOKEN',
          ...['LOCAL', ${JSON.stringify(mode.toUpperCase())}, ${JSON.stringify(mode.toUpperCase() + '_LOCAL')}].flatMap(suffix => ['VERIFY_' + suffix + '_SECRET', 'VITE_' + suffix + '_SECRET'])].includes(key);
        const expected = !${isolated} && active ? 'secret' : undefined;
        assert.equal(process.env[key], expected, key + ' in process.env');
        assert.equal(config.env[key], key.startsWith('VITE_') ? expected : undefined, key + ' in Vite env');
      }
      assert.equal(config.envDir === false, ${isolated});
      await nitro.close();
      process.exit(17);
    `)
    // Vitest resolves the app config under Node; production tooling uses pinned Bun.
    const launcher = mode === 'test'
      ? [...args.slice(0, args.indexOf('--') + 1), process.execPath]
      : args.slice(0, args.indexOf('--') + 3)
    const code = await runCommand([...launcher, probe], options)
    expect(code).toBe(17)
    expect(await readFile(join(root, 'env.d.ts'), 'utf8')).toContain('DATABASE_URL')
    await expect(access(join(cwd, 'env.d.ts'))).rejects.toThrow()
    return code
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await verify({ cwd, runtime: process.env.VERIFY_BUN_RUNTIME ?? 'bun', env: { AUTH_TEST_DATABASE_URL: database }, run })).toBe(17)
  expect(run).toHaveBeenCalledTimes(1)
})
