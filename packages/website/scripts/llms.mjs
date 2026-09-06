/*
 * Orthogonal intents (created 2026-09-06 Asia/Shanghai):
 * 1. The ONE llms.txt generation point, run AFTER vite build completes
 *    (orchestrated call, unipty precedent). The plugin-form closeBundle
 *    raced adapter-static's dist write on cold CI builders (rolldown
 *    closeBundle ordering) — the orchestrated form is deterministic.
 *
 * Config lives here (vite.config.ts no longer wires the plugin).
 */
import { generateLlmsTxt } from '../vite-plugins/llms-txt.mjs'

await generateLlmsTxt(new URL('../dist/', import.meta.url).pathname, {
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
})
