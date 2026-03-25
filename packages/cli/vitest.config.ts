import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Increase timeout for export tests which involve file I/O
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@openspecui/ai-provider': resolve(__dirname, '../ai-provider/src'),
      '@openspecui/core': resolve(__dirname, '../core/src'),
      '@openspecui/search': resolve(__dirname, '../search/src'),
      '@openspecui/search/node': resolve(__dirname, '../search/src/node.ts'),
      '@openspecui/server': resolve(__dirname, '../server/src'),
    },
  },
})
