/**
 * Orthogonal intents (updated 2026-08-08 Asia/Shanghai):
 * 1. Compose Storybook interaction tests with one real Chromium provider.
 * 2. Serialize Windows Story files so shared xterm and Pixi browser resources cannot starve plays.
 *
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    storybookTest({
      configDir: resolve(__dirname, '.storybook'),
      storybookScript: 'pnpm dev --ci',
      tags: {
        skip: ['skip-browser-test'],
      },
    }),
  ],
  test: {
    name: 'storybook',
    ...(process.platform === 'win32' ? { fileParallelism: false } : {}),
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    setupFiles: ['./.storybook/vitest.setup.ts'],
  },
})
