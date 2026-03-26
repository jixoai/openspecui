import type { Preview } from '@storybook/web-components-vite'

import '../src/index.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'terminal',
      values: [
        { name: 'terminal', value: '#1a1a1a' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
}

export default preview
