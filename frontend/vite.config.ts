// Use `vitest/config`'s defineConfig (which augments Vite's UserConfig with
// the `test` field) so this file is valid in both `vite build` and `vitest`.
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Use the ESM-native URL constructor instead of path + __dirname so the
// config works in both Node CJS and ESM environments without @types/node.
const srcDir = new URL('./src', import.meta.url).pathname

export default defineConfig(({ command, mode }) => {
  // VITE_API_URL is baked into the bundle. Without it src/lib/apiConfig.ts falls back to
  // localhost, which in a deployed build means a site that cannot reach its API. Refuse to build.
  if (command === 'build' && mode === 'production') {
    const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL?.trim()
    if (!apiUrl) {
      throw new Error(
        'VITE_API_URL is not set. Set it to the public API URL ending in /api ' +
          '(e.g. VITE_API_URL=https://api-crm.veloxverse.com/api) before `vite build`.',
      )
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3001,
    },
    resolve: {
      alias: {
        '@': srcDir,
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  }
})
