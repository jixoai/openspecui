import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Dialog } from './dialog'

describe('Dialog', () => {
  it('mounts dialog styles in document head instead of rendering style text in the body', () => {
    const { container } = render(
      <Dialog open={false} title="Dialog title" onClose={() => {}}>
        <div>Dialog body</div>
      </Dialog>
    )

    expect(container.querySelector('style')).toBeNull()

    const style = document.head.querySelector('[data-head-style="dialog:openspec-dialog"]')
    expect(style).not.toBeNull()
    expect(style?.textContent).toContain('dialog.openspec-dialog')
  })

  it('reuses a single shared head style for multiple dialogs', () => {
    render(
      <>
        <Dialog open={false} title="A" onClose={() => {}}>
          <div>A</div>
        </Dialog>
        <Dialog open={false} title="B" onClose={() => {}}>
          <div>B</div>
        </Dialog>
      </>
    )

    expect(
      document.head.querySelectorAll('[data-head-style="dialog:openspec-dialog"]')
    ).toHaveLength(1)
  })
})
