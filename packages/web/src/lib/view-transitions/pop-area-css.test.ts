import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const indexCssPath = resolve(process.cwd(), 'src/index.css')

describe('pop-area view transition css', () => {
  it('uses the pop-area shell as the route-top VT target', () => {
    const css = readFileSync(indexCssPath, 'utf8')

    expect(css).toContain(
      "html[data-vt-kind='route-top'][data-vt-area='pop'] dialog.openspec-dialog[open] .pop-area-vt-shell"
    )
    expect(css).not.toContain(
      "html[data-vt-kind='route-top'][data-vt-area='pop'] dialog.openspec-dialog[open] .pop-area-panel"
    )
  })
})
