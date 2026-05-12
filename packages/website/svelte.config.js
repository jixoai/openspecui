import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { mdsvex } from 'mdsvex'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.svx'],
  preprocess: [
    vitePreprocess({ script: true }),
    mdsvex({
      extensions: ['.svx'],
    }),
  ],
  kit: {
    adapter: adapter({
      pages: 'dist',
      assets: 'dist',
      strict: true,
    }),
    alias: {
      '@/*': './src/*',
      '@openspecui/web-src/*': '../web/src/*',
    },
  },
}

export default config
