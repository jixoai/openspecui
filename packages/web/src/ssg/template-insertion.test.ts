/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Prove the template insertion preserves inserted content byte-for-byte, including the
 *    `$` replacement-pattern sequences that used to corrupt exported pages (issue #319 #1).
 * 2. Prove an unreplaced placeholder fails loudly.
 *
 * Original request (2026-11-04): "同时，处理一下#319"
 */
import { describe, expect, it } from 'vitest'
import { insertDocumentValues } from './template-insertion'

const TEMPLATE = `<!doctype html>
<html>
  <head>
    <title>OpenSpec UI</title>
    <!--head-tags-->
  </head>
  <body>
    <div id="root"><!--app-html--></div>
  </body>
</html>`

function render(values: { appHtml?: string; headTags?: string; title?: string }): string {
  return insertDocumentValues(TEMPLATE, {
    appHtml: values.appHtml ?? '<p>app</p>',
    headTags: values.headTags ?? '<script>window.__INITIAL_DATA__ = {};</script>',
    title: values.title ?? 'Dashboard',
  })
}

describe('static document template insertion', () => {
  it('inserts the plain values and resolves every placeholder', () => {
    const html = render({ title: 'Dashboard' })

    expect(html).toContain('<div id="root"><p>app</p></div>')
    expect(html).toContain('<script>window.__INITIAL_DATA__ = {};</script>')
    expect(html).toContain('<title>Dashboard - OpenSpec UI</title>')
    expect(html).not.toContain('<!--app-html-->')
    expect(html).not.toContain('<!--head-tags-->')
  })

  // Red at this fixed point before the fix: a string replacement expanded `$'` to "everything
  // after the match", so the template tail landed inside the bootstrap JSON string.
  it.each([
    ["a$'b", '$'],
    ['a$`b', 'backtick'],
    ['a$&b', 'match'],
    ['a$$b', 'dollar'],
  ])('preserves %s verbatim instead of expanding a replacement pattern', (value) => {
    const html = render({
      headTags: `<script>window.__INITIAL_DATA__ = {"v":"${value}"};</script>`,
    })

    expect(html).toContain(`{"v":"${value}"}`)
    // The template tail must not have been injected into the inserted value.
    expect(html.match(/<\/html>/g)?.length).toBe(1)
    expect(html.match(/<!doctype html>/gi)?.length).toBe(1)
  })

  it('preserves the same sequences inside rendered app markup', () => {
    const html = render({ appHtml: '<pre>regex ^[a-z]+$&amp; note a$`b</pre>' })

    expect(html).toContain('<pre>regex ^[a-z]+$&amp; note a$`b</pre>')
    expect(html.match(/<\/html>/g)?.length).toBe(1)
  })

  it('fails loudly when the template no longer carries a placeholder', () => {
    const noAppPlaceholder = TEMPLATE.replace('<!--app-html-->', '')
    expect(() =>
      insertDocumentValues(noAppPlaceholder, { appHtml: '', headTags: '', title: 'x' })
    ).toThrow(/app-html placeholder/)

    const noHeadPlaceholder = TEMPLATE.replace('<!--head-tags-->', '')
    expect(() =>
      insertDocumentValues(noHeadPlaceholder, { appHtml: '', headTags: '', title: 'x' })
    ).toThrow(/head-tags placeholder/)
  })
})
