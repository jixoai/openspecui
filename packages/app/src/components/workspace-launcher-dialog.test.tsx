/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the Launcher Dialog renders a candidate list (not a URL input) as its direct plane (4.1 red -> green).
 * 2. Prove Focus/Open/unavailable command selection and the secondary connect flow (4.3-4.7).
 * 3. Prove forget/remove is distinct from closing an open Workspace (4.8).
 *
 * Original request (2026-07-30): "Workspaces融合了Connections，点击`+`，弹出的Dialog包含Connnections列表。"
 */
// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LauncherCandidate } from '../lib/workspace-launcher-selector'
import {
  WorkspaceLauncherDialog,
  type WorkspaceLauncherDialogProps,
} from './workspace-launcher-dialog'

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

const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close

function candidate(
  overrides: Partial<LauncherCandidate> & { apiBaseUrl: string }
): LauncherCandidate {
  return { reachability: 'online', source: 'manual', label: null, envUri: null, ...overrides }
}

function baseProps(
  overrides: Partial<WorkspaceLauncherDialogProps> = {}
): WorkspaceLauncherDialogProps {
  return {
    open: true,
    onClose: () => {},
    candidates: [],
    openWorkspaces: [],
    pending: [],
    onFocus: () => {},
    onOpen: () => {},
    onForget: () => {},
    onConnect: () => {},
    ...overrides,
  }
}

describe('Workspace Launcher Dialog (4.1/4.3-4.9)', () => {
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

  it('renders a candidate list (not a URL input) as the direct plane', async () => {
    await renderAt(
      <WorkspaceLauncherDialog
        {...baseProps({
          candidates: [
            candidate({ apiBaseUrl: 'http://a', label: { title: 'Project A' } }),
            candidate({ apiBaseUrl: 'http://b', label: { title: 'Project B' } }),
          ],
        })}
      />
    )
    expect(screen.getByText('Project A')).toBeTruthy()
    expect(screen.getByText('Project B')).toBeTruthy()
    // The direct plane is the candidate list + search, not a URL input.
    expect(screen.getByPlaceholderText('Search connections')).toBeTruthy()
    expect(screen.queryByPlaceholderText('http://localhost:3100')).toBeNull()
  })

  it('Focus activates the existing open Workspace; Open opens a closed candidate', async () => {
    const onFocus = vi.fn()
    const onOpen = vi.fn()
    await renderAt(
      <WorkspaceLauncherDialog
        {...baseProps({
          candidates: [
            candidate({ apiBaseUrl: 'http://open', label: { title: 'Open Proj' } }),
            candidate({ apiBaseUrl: 'http://closed', label: { title: 'Closed Proj' } }),
          ],
          openWorkspaces: [{ apiBaseUrl: 'http://open' }],
          onFocus,
          onOpen,
        })}
      />
    )
    fireEvent.click(screen.getByText('Focus'))
    fireEvent.click(screen.getByText('Open'))
    expect(onFocus).toHaveBeenCalledWith('http://open')
    expect(onOpen).toHaveBeenCalledWith('http://closed')
  })

  it('surfaces an unavailable candidate state directly (no Open button)', async () => {
    await renderAt(
      <WorkspaceLauncherDialog
        {...baseProps({
          candidates: [
            candidate({
              apiBaseUrl: 'http://x',
              reachability: 'offline',
              label: { title: 'Offline' },
            }),
          ],
        })}
      />
    )
    expect(screen.getByText('offline')).toBeTruthy()
    expect(screen.queryByText('Open')).toBeNull()
    expect(screen.queryByText('Focus')).toBeNull()
  })

  it('secondary connect flow: enter a URL and submit', async () => {
    const onConnect = vi.fn()
    await renderAt(<WorkspaceLauncherDialog {...baseProps({ onConnect })} />)
    fireEvent.click(screen.getByText('Connect another backend...'))
    const input = screen.getByPlaceholderText('http://localhost:3100') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'http://localhost:3200/' } })
    fireEvent.click(screen.getByText('Connect'))
    expect(onConnect).toHaveBeenCalledWith('http://localhost:3200')
  })

  it('rejects an invalid connect URL with a direct error', async () => {
    const onConnect = vi.fn()
    await renderAt(<WorkspaceLauncherDialog {...baseProps({ onConnect })} />)
    fireEvent.click(screen.getByText('Connect another backend...'))
    const input = screen.getByPlaceholderText('http://localhost:3100') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not a url' } })
    fireEvent.click(screen.getByText('Connect'))
    expect(screen.getByText(/valid backend API URL/)).toBeTruthy()
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('forget/remove is a row-menu action distinct from Focus/Open', async () => {
    const onForget = vi.fn()
    await renderAt(
      <WorkspaceLauncherDialog
        {...baseProps({
          candidates: [candidate({ apiBaseUrl: 'http://a', label: { title: 'Proj' } })],
          onForget,
        })}
      />
    )
    fireEvent.click(screen.getByLabelText('More actions for http://a'))
    fireEvent.click(screen.getByText('Forget connection'))
    expect(onForget).toHaveBeenCalledWith('http://a')
  })

  it('search filters the candidate list', async () => {
    await renderAt(
      <WorkspaceLauncherDialog
        {...baseProps({
          candidates: [
            candidate({ apiBaseUrl: 'http://a', label: { title: 'Alpha' } }),
            candidate({ apiBaseUrl: 'http://b', label: { title: 'Beta' } }),
          ],
        })}
      />
    )
    fireEvent.change(screen.getByPlaceholderText('Search connections'), {
      target: { value: 'alph' },
    })
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.queryByText('Beta')).toBeNull()
  })

  it('shows an empty state when there are no candidates', async () => {
    await renderAt(<WorkspaceLauncherDialog {...baseProps()} />)
    expect(screen.getByText(/No connection candidates yet/)).toBeTruthy()
  })
})
