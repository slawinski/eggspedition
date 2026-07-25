import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart(),
    nitro({
      preset: 'bun',
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
