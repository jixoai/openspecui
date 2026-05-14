import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@openspecui/core': resolve(__dirname, '../core/src'),
      '@openspecui/core/dashboard-display': resolve(__dirname, '../core/src/dashboard-display.ts'),
      '@openspecui/core/hosted-app': resolve(__dirname, '../core/src/hosted-app.ts'),
      '@openspecui/core/notifications': resolve(__dirname, '../core/src/notifications.ts'),
      '@openspecui/core/opsx-display-path': resolve(__dirname, '../core/src/opsx-display-path.ts'),
      '@openspecui/core/pty-protocol': resolve(__dirname, '../core/src/pty-protocol.ts'),
      '@openspecui/core/terminal-audio': resolve(__dirname, '../core/src/terminal-audio.ts'),
      '@openspecui/core/terminal-invocation': resolve(
        __dirname,
        '../core/src/terminal-invocation.ts'
      ),
      '@openspecui/search': resolve(__dirname, '../search/src'),
      '@openspecui/search/node': resolve(__dirname, '../search/src/node.ts'),
      '@openspecui/server': resolve(__dirname, '../server/src'),
    },
  },
  plugins: [
    storybookTest({
      configDir: resolve(__dirname, '.storybook'),
      storybookScript: 'pnpm storybook --ci',
    }),
  ],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    setupFiles: ['./.storybook/vitest.setup.ts'],
  },
})
