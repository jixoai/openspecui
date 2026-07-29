/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Run App component-boundary evidence in real headless Chromium.
 * 2. Compile the App and shared Web presentation styles used by those fixtures.
 *
 * Owner acceptance boundary (2026-07-20): Agents stop at basic component Playwright evidence.
 */
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@openspecui/core': resolve(__dirname, '../core/src'),
      '@openspecui/web-src': resolve(__dirname, '../web/src'),
    },
  },
  test: {
    name: 'app-browser',
    include: ['src/**/*.browser.test.{ts,tsx}'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
