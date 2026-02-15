import type { StorybookConfig } from '@storybook/web-components-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|ts)'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
}

export default config
