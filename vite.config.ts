import { defineConfig, type ConfigEnv, type PluginOption } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { createNitro } from 'nitro/builder'
import { fileURLToPath } from 'node:url'

function withoutStartDotenv(plugins: PluginOption[]): PluginOption[] {
  return plugins.flatMap((plugin) => Array.isArray(plugin)
    ? withoutStartDotenv(plugin)
    : plugin && 'name' in plugin && plugin.name === 'tanstack-start-core:load-env' ? [] : [plugin])
}

async function createConfig({ command }: ConfigEnv, isolated = false) {
  const nitroConfig = {
    preset: 'bun',
    // Passkey dependencies require this global polyfill before decorator evaluation.
    moduleSideEffects: [fileURLToPath(new URL('./node_modules/reflect-metadata/', import.meta.url))],
  }
  // Nitro's Vite plugin overrides its own dotenv option. A preinitialized instance
  // is required to disable that independent loader as well as Vite's envDir.
  const instance = isolated
    ? await createNitro({ ...nitroConfig, rootDir: process.cwd(), builder: 'vite', dev: command === 'serve' }, { dotenv: false })
    : undefined
  return defineConfig({
    envDir: isolated ? false : undefined,
    plugins: [
      devtools(),
      tsconfigPaths({ projects: ['./tsconfig.json'] }),
      // Start also calls loadEnv(root) independently of Vite's envDir setting.
      isolated ? withoutStartDotenv(tanstackStart()) : tanstackStart(),
      nitro({ ...nitroConfig, ...(instance ? { _nitro: instance } : {}) }),
      viteReact(),
    ],
    css: {
      modules: {
        // Include filename to prevent cross-module collisions
        generateScopedName: '[name]_[local]',
      },
    },
  })
}

export const createVerificationConfig = (env: ConfigEnv) => createConfig(env, true)

export default defineConfig((env) => createConfig(env))
