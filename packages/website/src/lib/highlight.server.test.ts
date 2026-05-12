import { highlightHookExample } from '$lib/highlight.server'
import { en } from '$lib/i18n/locales/en'
import { describe, expect, it } from 'vitest'

describe('highlightHookExample', () => {
  it('renders static shiki html with light and dark theme variables', async () => {
    const hook = await highlightHookExample(en.hooks.onReadDocument)

    expect(hook.exampleHtml).toContain('class="shiki shiki-themes')
    expect(hook.exampleHtml).toContain('--shiki-light')
    expect(hook.exampleHtml).toContain('--shiki-dark')
    expect(hook.exampleHtml).toContain('--shiki-light-bg:#faf4ed')
    expect(hook.exampleHtml).toContain('--shiki-dark-bg:#390000')
    expect(hook.exampleHtml).toContain('onReadDocument')
  })
})
