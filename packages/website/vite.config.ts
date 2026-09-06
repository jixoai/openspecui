/*
 * Orthogonal intents (updated 2026-09-06 Asia/Shanghai):
 * 1. SvelteKit + Tailwind v4 + vitest wiring for the static site build.
 * 2. AI export layer moved OUT of the build plugins: the llmsTxt
 *    closeBundle form raced adapter-static's dist write on cold CI
 *    builders; generation now runs as a post-build orchestrated step
 *    (scripts/llms.mjs, the package build script).
 *
 * Original request (2026-09-06): 官网接入 @jixoai registry（jixoai-ui 0.3.0）。
 * The `@openspecui/web-src` alias retired with the palette import.
 */
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss(),
    svelteTesting(),
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
