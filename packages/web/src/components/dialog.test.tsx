import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from './dialog'

describe('Dialog', () => {
  afterEach(() => {
    cleanup()
  })

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

  it('labels the native dialog from the visible title', () => {
    const { getByRole } = render(
      <Dialog open title="Dialog title" onClose={() => {}}>
        <div>Dialog body</div>
      </Dialog>
    )

    expect(getByRole('dialog', { name: 'Dialog title', hidden: true })).toBeTruthy()
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

  it('does not close when a child click reports zero coordinates', () => {
    const onClose = vi.fn()
    const { getByText } = render(
      <Dialog open title="Dialog title" onClose={onClose}>
        <button type="button">Inner action</button>
      </Dialog>
    )

    fireEvent.click(getByText('Inner action'), { clientX: 0, clientY: 0 })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('uses the close handler for outside dismiss by default', () => {
    const onClose = vi.fn()
    const { getByRole } = render(
      <Dialog open title="Dialog title" onClose={onClose}>
        <div>Dialog body</div>
      </Dialog>
    )

    const dialog = getByRole('dialog', { hidden: true })
    fireEvent.click(dialog, { clientX: 1, clientY: 1 })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('can block outside dismiss with null', () => {
    const onClose = vi.fn()
    const { getByRole } = render(
      <Dialog open title="Dialog title" onClose={onClose} onDismissRequest={null}>
        <div>Dialog body</div>
      </Dialog>
    )

    const dialog = getByRole('dialog', { hidden: true })
    fireEvent.click(dialog, { clientX: 1, clientY: 1 })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('can handle outside dismiss with a custom request handler', () => {
    const onClose = vi.fn()
    const onDismissRequest = vi.fn()
    const { getByRole } = render(
      <Dialog open title="Dialog title" onClose={onClose} onDismissRequest={onDismissRequest}>
        <div>Dialog body</div>
      </Dialog>
    )

    const dialog = getByRole('dialog', { hidden: true })
    fireEvent.click(dialog, { clientX: 1, clientY: 1 })

    expect(onDismissRequest).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps explicit close actions on the close handler', () => {
    const onClose = vi.fn()
    const { getByRole } = render(
      <Dialog open title="Dialog title" onClose={onClose} onDismissRequest={null}>
        <div>Dialog body</div>
      </Dialog>
    )

    fireEvent.click(getByRole('button', { name: 'Close dialog' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
