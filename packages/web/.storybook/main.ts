import type { StorybookConfig } from '@storybook/web-components-vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
  viteFinal(config) {
    config.resolve ??= {}
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(dirname, '../src'),
      '@openspecui/core': path.resolve(dirname, '../../core/src'),
      '@openspecui/server': path.resolve(dirname, '../../server/src'),
    }
    return config
  },
}

export default config
