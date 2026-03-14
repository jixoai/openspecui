// @vitest-environment jsdom

import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getHostedShellStorageKey } from '../lib/shell-state'
import { HostedShell } from './hosted-shell'

const originalFetch = global.fetch
const originalMatchMedia = window.matchMedia
const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close
const originalConsoleError = console.error

interface FetchHealthOptions {
  online?: boolean
  projectName?: string
  openspecuiVersion?: string
}

interface HostedFetchOptions extends FetchHealthOptions {
  perApi?: Record<string, FetchHealthOptions>
}

function setSuccessfulFetch(options?: HostedFetchOptions) {
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
              shellPath: '/versions/latest/',
              major: 2,
            },
            'v2.0': {
              id: 'v2.0',
              kind: 'minor',
              selector: '~2.0',
              resolvedVersion: '2.0.9',
              rootPath: '/versions/v2.0/',
              shellPath: '/versions/v2.0/',
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
      const apiBaseUrl = url.replace(/\/api\/health$/, '')
      const health = options?.perApi?.[apiBaseUrl] ?? options
      if (health?.online === false) {
        throw new Error('offline')
      }

      return new Response(
        JSON.stringify({
          status: 'ok',
          projectDir: `/tmp/${health?.projectName ?? 'opsx-project'}`,
          projectName: health?.projectName ?? 'opsx-project',
          watcherEnabled: true,
          openspecuiVersion: health?.openspecuiVersion ?? '2.0.2',
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

function setIframeReloadSpy(iframe: HTMLIFrameElement, reload: ReturnType<typeof vi.fn>) {
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: {
      location: {
        href: iframe.getAttribute('src') ?? iframe.src,
        reload,
      },
    },
  })
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
    vi.spyOn(console, 'error').mockImplementation((message: unknown, ...args: unknown[]) => {
      const text =
        typeof message === 'string'
          ? message
          : message instanceof Error
            ? message.message
            : String(message ?? '')
      if (text.includes('Could not parse CSS stylesheet')) {
        return
      }
      originalConsoleError(message, ...args)
    })
    document.body.innerHTML = ''
    localStorage.clear()
    setSuccessfulFetch()
  })

  afterEach(() => {
    global.fetch = originalFetch
    window.matchMedia = originalMatchMedia
    HTMLDialogElement.prototype.showModal = originalShowModal
    HTMLDialogElement.prototype.close = originalClose
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
      '/versions/v2.0/?api=http%3A%2F%2Flocalhost%3A3100&session='
    )
    expect(screen.getByText('Loading view...')).toBeTruthy()

    await act(async () => {
      if (iframe) {
        fireEvent.load(iframe)
      }
    })

    expect(screen.queryByText('Loading view...')).toBeNull()
  })

  it('opens the add dialog when the empty shell header is double-clicked', async () => {
    const { container } = await renderShell(
      <HostedShell initialLaunchRequest={null} fallbackLaunchRequest={null} initialError={null} />
    )

    const strip = container.querySelector('.tabs-strip')
    expect(strip).toBeTruthy()

    await act(async () => {
      if (strip) {
        fireEvent.doubleClick(strip)
      }
    })

    expect(document.querySelector('dialog[open]')).toBeTruthy()
    expect(screen.getByLabelText('API URL')).toBeTruthy()
  })

  it('opens the add dialog when the tabs bar empty space is double-clicked', async () => {
    const { container } = await renderShell(
      <HostedShell
        initialLaunchRequest={{
          apiBaseUrl: 'http://localhost:3100',
        }}
        initialError={null}
      />
    )

    const tabsBar = container.querySelector('.tabs-button')
    expect(tabsBar).toBeTruthy()

    await act(async () => {
      if (tabsBar) {
        fireEvent.doubleClick(tabsBar)
      }
    })

    expect(document.querySelector('dialog[open]')).toBeTruthy()
  })

  it('reloads only the current active iframe when the refresh action is clicked', async () => {
    localStorage.setItem(
      getHostedShellStorageKey(),
      JSON.stringify({
        activeTabId: 'tab-2',
        tabs: [
          {
            id: 'tab-1',
            sessionId: 'tab-1',
            apiBaseUrl: 'http://localhost:3100',
            createdAt: 1,
          },
          {
            id: 'tab-2',
            sessionId: 'tab-2',
            apiBaseUrl: 'http://localhost:3200',
            createdAt: 2,
          },
        ],
      })
    )
    setSuccessfulFetch({
      perApi: {
        'http://localhost:3100': {
          projectName: 'alpha',
          openspecuiVersion: '2.0.2',
        },
        'http://localhost:3200': {
          projectName: 'beta',
          openspecuiVersion: '2.0.2',
        },
      },
    })

    const { container } = await renderShell(
      <HostedShell initialLaunchRequest={null} fallbackLaunchRequest={null} initialError={null} />
    )

    const alphaFrame = container.querySelector('iframe[title="Hosted OpenSpec UI alpha"]')
    const betaFrame = container.querySelector('iframe[title="Hosted OpenSpec UI beta"]')
    expect(alphaFrame).toBeTruthy()
    expect(betaFrame).toBeTruthy()

    await act(async () => {
      if (alphaFrame) {
        fireEvent.load(alphaFrame)
      }
      if (betaFrame) {
        fireEvent.load(betaFrame)
      }
    })

    const alphaReload = vi.fn()
    const betaReload = vi.fn()
    if (alphaFrame instanceof HTMLIFrameElement) {
      setIframeReloadSpy(alphaFrame, alphaReload)
    }
    if (betaFrame instanceof HTMLIFrameElement) {
      setIframeReloadSpy(betaFrame, betaReload)
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reload current tab' }))
    })

    expect(alphaReload).not.toHaveBeenCalled()
    expect(betaReload).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Loading view...')).toBeTruthy()
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
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
