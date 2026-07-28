/**
 * @vitest-environment node
 *
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove static bootstrap data survives HTML parsing without escaping its script owner.
 * 2. Prove user-controlled base paths and titles cannot create executable document markup.
 * 3. Preserve the exact serialized values after safe document embedding.
 *
 * Owner-reported defect (2026-07-28): "导出的数据好像逃逸到 html 去了。"
 */
import { JSDOM, VirtualConsole } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { createStaticDocumentTitle, createStaticHeadTags } from './static-document'

interface StaticBootstrapWindow {
  __INJECTED__?: boolean
  __INITIAL_DATA__?: unknown
  __OPENSPEC_BASE_PATH__?: string
}

function bootstrapWindow(head: string): StaticBootstrapWindow & Window {
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', () => undefined)
  return new JSDOM(`<!doctype html><html><head>${head}</head><body></body></html>`, {
    runScripts: 'dangerously',
    virtualConsole,
  }).window as unknown as StaticBootstrapWindow & Window
}

describe('static document embedding', () => {
  it('round-trips source previews without closing the bootstrap script', () => {
    const snapshot = {
      content:
        'before</script><p id="leaked-preview">escaped</p><script>window.__INJECTED__=true</script>after',
      separators: String.fromCodePoint(0x2028, 0x2029),
    }
    const basePath = "/docs/'</script><script>window.__INJECTED__=true</script>"
    const window = bootstrapWindow(createStaticHeadTags(snapshot, basePath))

    expect(window.__INITIAL_DATA__).toEqual(snapshot)
    expect(window.__OPENSPEC_BASE_PATH__).toBe(basePath)
    expect(window.document.querySelector('#leaked-preview')).toBeNull()
    expect(window.__INJECTED__).toBeUndefined()
  })

  it('keeps a user-controlled title inside the title element', () => {
    const title = 'Spec </title><script>window.__INJECTED__=true</script>'
    const window = bootstrapWindow(`<title>${createStaticDocumentTitle(title)}</title>`)

    expect(window.document.title).toBe(`${title} - OpenSpec UI`)
    expect(window.__INJECTED__).toBeUndefined()
  })
})
