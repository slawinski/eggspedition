import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { fileURLToPath } from 'node:url'

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart(),
    nitro({
      preset: 'bun',
      // Passkey dependencies require this global polyfill before decorator evaluation.
      moduleSideEffects: [fileURLToPath(new URL('./node_modules/reflect-metadata/', import.meta.url))],
    }),
    viteReact(),
  ],
  css: {
    modules: {
      // Include filename to prevent cross-module collisions
      generateScopedName: '[name]_[local]',
    },
  },
})

export default config
