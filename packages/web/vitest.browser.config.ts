import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const alias = {
  '@': resolve(__dirname, './src'),
  '@openspecui/core': resolve(__dirname, '../core/src'),
  '@openspecui/core/dashboard-display': resolve(__dirname, '../core/src/dashboard-display.ts'),
  '@openspecui/core/hosted-app': resolve(__dirname, '../core/src/hosted-app.ts'),
  '@openspecui/core/opsx-display-path': resolve(__dirname, '../core/src/opsx-display-path.ts'),
  '@openspecui/core/pty-protocol': resolve(__dirname, '../core/src/pty-protocol.ts'),
  '@openspecui/search': resolve(__dirname, '../search/src'),
  '@openspecui/search/node': resolve(__dirname, '../search/src/node.ts'),
  '@openspecui/server': resolve(__dirname, '../server/src'),
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias,
  },
  test: {
    name: 'browser',
    include: ['src/**/*.browser.test.{ts,tsx}'],
    setupFiles: './src/test/browser.setup.ts',
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
