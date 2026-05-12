import HookReference from '$lib/components/hook-reference.svelte'
import { en } from '$lib/i18n/locales/en'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'

describe('HookReference', () => {
  it('renders the stable hook contract', () => {
    render(HookReference, { hook: en.hooks.onReadDocument })

    expect(screen.getByText('onReadDocument')).toBeVisible()
    expect(screen.getByText(/Customize markdown-like OpenSpec document text/)).toBeVisible()
    expect(screen.getAllByText(/onReadDocument\(ctx, read\)/).length).toBeGreaterThan(0)
    expect(screen.getByText('Markdown preprocessing')).toBeVisible()
  })

  it('renders pre-highlighted code when available', () => {
    render(HookReference, {
      hook: {
        ...en.hooks.onReadDocument,
        exampleHtml: '<pre class="shiki"><code>highlighted</code></pre>',
      },
    })

    expect(screen.getByText('highlighted')).toBeVisible()
  })
})
