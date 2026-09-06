/*
 * Orthogonal intents (updated 2026-09-06 Asia/Shanghai):
 * 1. SvelteKit + Tailwind v4 + vitest wiring for the static site build.
 * 2. AI export layer: the @jixoai llms-txt vite plugin (ONE generation
 *    point — runs in the SSR build's closeBundle, after adapter-static
 *    wrote the final dist; en/zh locale mirrors, absolute URLs).
 *
 * Original request (2026-09-06): 官网接入 @jixoai registry（jixoai-ui 0.3.0）。
 * The `@openspecui/web-src` alias retired with the palette import.
 */
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { llmsTxt } from './vite-plugins/llms-txt.mjs'

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss(),
    svelteTesting(),
    llmsTxt({
      siteUrl: 'https://www.openspecui.com',
      title: 'OpenSpecUI',
      summary:
        'OpenSpecUI gives OpenSpec projects a visual frontend and a static documentation site: dashboard, change workflow, config workbench, terminals, and static export.',
      // the root index is a JS locale redirect — no LLM content lives there
      exclude: ['404.html', 'index.html'],
      locale: {
        segments: ['en', 'zh'],
        default: 'en',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
