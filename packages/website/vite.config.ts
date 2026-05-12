import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [sveltekit(), tailwindcss(), svelteTesting()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@openspecui/web-src': resolve(__dirname, '../web/src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
