import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { mdsvex } from 'mdsvex'
import { highlightCodeToHtml } from './syntax-highlight.js'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.svx'],
  preprocess: [
    vitePreprocess({ script: true }),
    mdsvex({
      extensions: ['.svx'],
      highlight: {
        highlighter: (code, lang) => highlightCodeToHtml(code, { language: lang }),
      },
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
