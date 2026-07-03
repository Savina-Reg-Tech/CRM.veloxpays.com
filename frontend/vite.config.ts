// Use `vitest/config`'s defineConfig (which augments Vite's UserConfig with
// the `test` field) so this file is valid in both `vite build` and `vitest`.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Use the ESM-native URL constructor instead of path + __dirname so the
// config works in both Node CJS and ESM environments without @types/node.
const srcDir = new URL('./src', import.meta.url).pathname

export default defineConfig({
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
})
