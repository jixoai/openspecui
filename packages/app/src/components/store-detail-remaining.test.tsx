/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove New Store flow gates on authority + lifecycle (7.6).
 * 2. Prove Environment evidence subpage renders observed-only facts + conflict (7.7).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 */
// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NewStoreDialog } from './new-store-dialog'
import { StoresEnvironmentEvidence } from './stores-environment-evidence'

const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close

async function renderAt(element: ReactElement): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(element)
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return { container, root }
}

describe('NewStoreDialog (7.6)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open')
    }
  })
  afterEach(() => {
    HTMLDialogElement.prototype.showModal = originalShowModal
    HTMLDialogElement.prototype.close = originalClose
    document.body.innerHTML = ''
  })

  it('gates submit on current Environment authority', async () => {
    const onSubmit = vi.fn()
    await renderAt(
      <NewStoreDialog
        open
        onClose={() => {}}
        hasAuthority={false}
        lifecycle="idle"
        onSubmit={onSubmit}
      />
    )
    expect(screen.getByText(/No current Environment authority/)).toBeTruthy()
    // The Register button is disabled without authority.
    const submitButton = screen.getByText('Register').closest('button')
    expect(submitButton?.hasAttribute('disabled')).toBe(true)
  })

  it('submits with kind + path + storeId and locks while pending', async () => {
    const onSubmit = vi.fn()
    await renderAt(
      <NewStoreDialog
        open
        onClose={() => {}}
        hasAuthority
        lifecycle="pending"
        onSubmit={onSubmit}
      />
    )
    // Pending locks the submit.
    const submitButton = screen.getByText('Register').closest('button')
    expect(submitButton?.hasAttribute('disabled')).toBe(true)
  })

  it('submits a register mutation with path and store id', async () => {
    const onSubmit = vi.fn()
    await renderAt(
      <NewStoreDialog open onClose={() => {}} hasAuthority lifecycle="idle" onSubmit={onSubmit} />
    )
    const pathInput = screen.getByPlaceholderText('/path/to/store-root') as HTMLInputElement
    fireEvent.change(pathInput, { target: { value: '/stores/team' } })
    const idInput = screen.getByPlaceholderText('my-store') as HTMLInputElement
    fireEvent.change(idInput, { target: { value: 'team' } })
    fireEvent.click(screen.getByText('Register'))
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'register',
      path: '/stores/team',
      storeId: 'team',
    })
  })
})

describe('StoresEnvironmentEvidence (7.7)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders observed environments, projects, CLI versions, and capabilities', async () => {
    await renderAt(
      <StoresEnvironmentEvidence
        environments={[
          {
            envUri: 'env://1',
            observedAt: 1700000000000,
            projects: [
              {
                sourceId: 'ws-a',
                label: 'project-a',
                cliVersion: '1.6.0',
                capabilities: ['stores.inspect'],
              },
            ],
          },
        ]}
        onBack={() => {}}
      />
    )
    expect(screen.getByText('env://1')).toBeTruthy()
    expect(screen.getByText('project-a')).toBeTruthy()
    expect(screen.getByText('CLI 1.6.0')).toBeTruthy()
    expect(screen.getByText('stores.inspect')).toBeTruthy()
  })

  it('renders an empty observed state without claiming completeness', async () => {
    await renderAt(<StoresEnvironmentEvidence environments={[]} onBack={() => {}} />)
    expect(screen.getByText('No runtime environments observed.')).toBeTruthy()
  })

  it('surfaces a same-Environment source conflict directly', async () => {
    await renderAt(
      <StoresEnvironmentEvidence
        environments={[
          {
            envUri: 'env://1',
            observedAt: 1,
            projects: [],
            conflict: { message: 'Sources disagree on Store identity' },
          },
        ]}
        onBack={() => {}}
      />
    )
    expect(screen.getByText('Sources disagree on Store identity')).toBeTruthy()
  })
})
