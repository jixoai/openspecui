// @vitest-environment jsdom

import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HostedShell } from './hosted-shell'

const REFRESH_FEEDBACK_MS = 1200

const originalFetch = global.fetch
const originalMatchMedia = window.matchMedia
const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close

function setSuccessfulFetch(options?: {
  online?: boolean
  projectName?: string
  openspecuiVersion?: string
}) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url.endsWith('/version.json')) {
      return new Response(
        JSON.stringify({
          packageName: 'openspecui',
          generatedAt: '2026-03-09T00:00:00.000Z',
          defaultChannel: 'latest',
          channels: {
            latest: {
              id: 'latest',
              kind: 'latest',
              selector: 'latest',
              resolvedVersion: '2.1.3',
              rootPath: '/versions/latest/',
              shellPath: '/versions/latest/index.html',
              major: 2,
            },
            'v2.0': {
              id: 'v2.0',
              kind: 'minor',
              selector: '~2.0',
              resolvedVersion: '2.0.9',
              rootPath: '/versions/v2.0/',
              shellPath: '/versions/v2.0/index.html',
              major: 2,
              minor: 0,
            },
          },
          compatibility: [{ range: '~2.0.0', channel: 'v2.0' }],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    }

    if (url.endsWith('/api/health')) {
      if (options?.online === false) {
        throw new Error('offline')
      }

      return new Response(
        JSON.stringify({
          status: 'ok',
          projectDir: `/tmp/${options?.projectName ?? 'opsx-project'}`,
          projectName: options?.projectName ?? 'opsx-project',
          watcherEnabled: true,
          openspecuiVersion: options?.openspecuiVersion ?? '2.0.2',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }) as typeof fetch
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function renderShell(element: ReactElement): Promise<{
  container: HTMLDivElement
  root: Root
}> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(element)
  })
  await flushEffects()
  return { container, root }
}

describe('HostedShell', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as typeof window.matchMedia
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
    document.body.innerHTML = ''
    localStorage.clear()
    setSuccessfulFetch()
  })

  afterEach(() => {
    global.fetch = originalFetch
    window.matchMedia = originalMatchMedia
    HTMLDialogElement.prototype.showModal = originalShowModal
    HTMLDialogElement.prototype.close = originalClose
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('creates an initial iframe tab from the launch request and resolves the bundle from health metadata', async () => {
    const { container } = await renderShell(
      <HostedShell
        initialLaunchRequest={{
          apiBaseUrl: 'http://localhost:3100',
        }}
        initialError={null}
      />
    )

    expect(container.textContent ?? '').toContain('opsx-project')
    const iframe = container.querySelector('iframe[title="Hosted OpenSpec UI opsx-project"]')
    expect(iframe?.getAttribute('src')).toContain(
      '/versions/v2.0/index.html?api=http%3A%2F%2Flocalhost%3A3100&session='
    )
  })

  it('uses the terminal tab styling for hosted sessions', async () => {
    const { container } = await renderShell(
      <HostedShell
        initialLaunchRequest={{
          apiBaseUrl: 'http://localhost:3100',
        }}
        initialError={null}
      />
    )

    const tabsRoot = container.querySelector('[data-tabs-variant="terminal"]')
    expect(tabsRoot).not.toBeNull()

    const selectedTab = container.querySelector('.tab-selected')
    expect(selectedTab?.className).toContain('bg-background')
    expect(selectedTab?.className).toContain('text-foreground')

    const refreshButton = screen.getByLabelText('Refresh backend metadata')
    const addButton = screen.getByLabelText('Add backend API')
    expect(refreshButton.className).toContain('bg-terminal')
    expect(addButton.className).toContain('bg-terminal')
  })

  it('opens the add API dialog with the shared dialog shell', async () => {
    const { container } = await renderShell(
      <HostedShell
        initialLaunchRequest={{
          apiBaseUrl: 'http://localhost:3100',
        }}
        initialError={null}
      />
    )

    fireEvent.click(screen.getByLabelText('Add backend API'))
    await flushEffects()

    expect(screen.getByText('Add Backend API')).not.toBeNull()
    const dialog = container.querySelector('dialog.openspec-dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    const panel = dialog?.querySelector('.max-w-2xl')
    expect(panel).not.toBeNull()
    expect(panel?.className).not.toContain('rounded-none')
  })

  it('shows transient active feedback while refresh is running', async () => {
    vi.useFakeTimers()
    await renderShell(
      <HostedShell
        initialLaunchRequest={{
          apiBaseUrl: 'http://localhost:3100',
        }}
        initialError={null}
      />
    )

    const refreshButton = screen.getByLabelText('Refresh backend metadata')
    fireEvent.click(refreshButton)
    await flushEffects()

    expect(refreshButton.className.split(/\s+/)).toContain('bg-background')
    const icon = refreshButton.querySelector('svg')
    expect(icon?.getAttribute('class')).toContain('animate-spin')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_FEEDBACK_MS)
    })
    await flushEffects()

    expect(refreshButton.className.split(/\s+/)).not.toContain('bg-background')
  })
  it('seeds a fallback launch request when the shell starts empty', async () => {
    const { container } = await renderShell(
      <HostedShell
        initialLaunchRequest={null}
        fallbackLaunchRequest={{
          apiBaseUrl: 'http://localhost:3100',
        }}
        initialError={null}
      />
    )

    expect(container.textContent ?? '').toContain('opsx-project')
    const iframe = container.querySelector('iframe[title="Hosted OpenSpec UI opsx-project"]')
    expect(iframe?.getAttribute('src')).toContain(
      '/versions/v2.0/index.html?api=http%3A%2F%2Flocalhost%3A3100&session='
    )
  })

  it('restores persisted tabs and keeps the saved active tab selected', async () => {
    localStorage.setItem(
      'openspecui-app:shell',
      JSON.stringify({
        activeTabId: 'session-b',
        tabs: [
          {
            id: 'session-a',
            sessionId: 'session-a',
            apiBaseUrl: 'http://localhost:3100',
            createdAt: 1,
          },
          {
            id: 'session-b',
            sessionId: 'session-b',
            apiBaseUrl: 'http://localhost:3200',
            createdAt: 2,
          },
        ],
      })
    )

    const { container } = await renderShell(
      <HostedShell initialLaunchRequest={null} initialError={null} />
    )

    const selected = container.querySelector('.tab-selected')
    expect(selected?.textContent ?? '').toContain('http://localhost:3200')
  })

  it('keeps the fallback launch request from overwriting persisted tabs', async () => {
    localStorage.setItem(
      'openspecui-app:shell',
      JSON.stringify({
        activeTabId: 'session-b',
        tabs: [
          {
            id: 'session-a',
            sessionId: 'session-a',
            apiBaseUrl: 'http://localhost:3100',
            createdAt: 1,
          },
          {
            id: 'session-b',
            sessionId: 'session-b',
            apiBaseUrl: 'http://localhost:3200',
            createdAt: 2,
          },
        ],
      })
    )

    const { container } = await renderShell(
      <HostedShell
        initialLaunchRequest={null}
        fallbackLaunchRequest={{
          apiBaseUrl: 'http://localhost:3300',
        }}
        initialError={null}
      />
    )

    expect(container.textContent ?? '').toContain('http://localhost:3200')
    expect(container.textContent ?? '').not.toContain('http://localhost:3300')
  })

  it('syncs externally persisted shell state without a page refresh', async () => {
    const { container } = await renderShell(
      <HostedShell initialLaunchRequest={null} initialError={null} />
    )

    expect(container.textContent ?? '').toContain('No Hosted Sessions')

    act(() => {
      localStorage.setItem(
        'openspecui-app:shell',
        JSON.stringify({
          activeTabId: 'session-a',
          tabs: [
            {
              id: 'session-a',
              sessionId: 'session-a',
              apiBaseUrl: 'http://localhost:3100',
              createdAt: 1,
            },
          ],
        })
      )
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'openspecui-app:shell',
        })
      )
    })

    await flushEffects()
    await flushEffects()

    expect(container.textContent ?? '').toContain('opsx-project')
    const iframe = container.querySelector('iframe[title="Hosted OpenSpec UI opsx-project"]')
    expect(iframe?.getAttribute('src')).toContain('/versions/v2.0/index.html?api=')
  })

  it('keeps offline tabs visible and shows retry guidance', async () => {
    setSuccessfulFetch({ online: false })

    const { container } = await renderShell(
      <HostedShell
        initialLaunchRequest={{
          apiBaseUrl: 'http://localhost:3100',
        }}
        initialError={null}
      />
    )

    await flushEffects()

    expect(container.textContent ?? '').toContain('Backend unreachable')
    const retryButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Retry'
    )
    expect(retryButton).not.toBeUndefined()
  })
})
