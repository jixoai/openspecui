import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@openspecui/core': resolve(__dirname, '../core/src'),
      '@openspecui/core/hosted-app': resolve(__dirname, '../core/src/hosted-app.ts'),
      '@openspecui/web-src': resolve(__dirname, '../web/src'),
    },
  },
  test: {
    environment: 'node',
  },
})
