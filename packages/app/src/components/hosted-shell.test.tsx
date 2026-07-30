/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove health metadata creates the canonical authenticated Project Web iframe.
 * 2. Prove explicit refresh, tab switching, and dialog interactions target the intended tab.
 * 3. Preserve per-tab iframe sessions and runtime identity across ordinary shell updates.
 * 4. Keep a rendered iframe mounted while backend health is revalidated or temporarily offline, with
 *    distinct visual loading and terminal frame-error evidence.
 * 5. Prove the Project Web iframe receives only the Clipboard capabilities Terminal requires.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Owner-reported defect (2026-07-26): "Dashboard加载完成的一瞬间开始reload。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 */
// @vitest-environment jsdom

import { buildBackendHealthPayload } from '@openspecui/core/hosted-app'
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getHostedShellStorageKey } from '../lib/shell-state'
import { HostedShell, HostedShellTabContent } from './hosted-shell'

const originalFetch = global.fetch
const originalMatchMedia = window.matchMedia
const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close
const originalConsoleError = console.error
const renderedRoots = new Set<Root>()

interface FetchHealthOptions {
  online?: boolean
  projectName?: string
  openspecuiVersion?: string
}

interface HostedFetchOptions extends FetchHealthOptions {
  perApi?: Record<string, FetchHealthOptions>
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolvePromise: ((value: T) => void) | null = null
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value) {
      if (!resolvePromise) throw new Error('Deferred promise is not initialized.')
      resolvePromise(value)
    },
  }
}

function setSuccessfulFetch(options?: HostedFetchOptions) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url.endsWith('/api/health')) {
      const apiBaseUrl = url.replace(/\/api\/health$/, '')
      const health = options?.perApi?.[apiBaseUrl] ?? options
      if (health?.online === false) {
        throw new Error('offline')
      }

      return new Response(
        JSON.stringify(
          buildBackendHealthPayload({
            projectDir: `/tmp/${health?.projectName ?? 'opsx-project'}`,
            projectName: health?.projectName ?? 'opsx-project',
            watcherEnabled: true,
            openspecuiVersion: health?.openspecuiVersion ?? '2.0.2',
            embeddedUiUrl: `${apiBaseUrl}/dashboard`,
          })
        ),
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
  renderedRoots.add(root)
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

  afterEach(async () => {
    await act(async () => {
      for (const root of renderedRoots) root.unmount()
    })
    renderedRoots.clear()
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
      'http://localhost:3100/dashboard?api=http%3A%2F%2Flocalhost%3A3100&session='
    )
    expect(iframe?.getAttribute('allow')).toBe('clipboard-read; clipboard-write')
    expect(container.querySelector('.rt-skeleton')).toBeTruthy()

    await act(async () => {
      if (iframe) {
        fireEvent.load(iframe)
      }
    })

    expect(container.querySelector('.rt-skeleton')).toBeNull()
  })

  it('renders frame-error evidence without classifying the error state as loading', async () => {
    const { container } = await renderShell(
      <HostedShellTabContent
        tab={{
          id: 'tab-a',
          sessionId: 'session-a',
          apiBaseUrl: 'http://localhost:3100',
          createdAt: 1,
        }}
        runtime={{
          reachability: 'online',
          projectName: 'opsx-project',
          projectDir: '/tmp/opsx-project',
          openspecuiVersion: '2.0.2',
          embeddedUiUrl: 'http://localhost:3100/dashboard',
          errorMessage: null,
        }}
        frameState={{
          src: 'http://localhost:3100/dashboard',
          status: 'error',
        }}
        onRetry={vi.fn()}
        onSetIframeRef={vi.fn()}
        onFrameLoad={vi.fn()}
        onFrameError={vi.fn()}
      />
    )

    expect(screen.getByText('Reload did not finish. Try refresh again.')).toBeTruthy()
    expect(container.querySelector('.rt-skeleton')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('uses stable visual geometry while backend metadata is unresolved', async () => {
    const { container } = await renderShell(
      <HostedShellTabContent
        tab={{
          id: 'tab-a',
          sessionId: 'session-a',
          apiBaseUrl: 'http://localhost:3100',
          createdAt: 1,
        }}
        runtime={{
          reachability: 'checking',
          projectName: null,
          projectDir: null,
          openspecuiVersion: null,
          embeddedUiUrl: null,
          errorMessage: null,
        }}
        frameState={{ src: null, status: 'idle' }}
        onRetry={vi.fn()}
        onSetIframeRef={vi.fn()}
        onFrameLoad={vi.fn()}
        onFrameError={vi.fn()}
      />
    )

    expect(container.querySelectorAll('.rt-skeleton')).toHaveLength(3)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector('[role="status"]')?.textContent).toContain('connecting backend')
    expect(screen.queryByText('Connecting Backend')).toBeNull()
  })

  it('keeps the iframe mounted while a background health refresh is pending', async () => {
    const replacementHealth = deferred<Response>()
    const immediateFetch = global.fetch
    let healthRequestCount = 0
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.endsWith('/api/health')) {
        healthRequestCount += 1
        if (healthRequestCount === 2) return replacementHealth.promise
      }
      return immediateFetch(input, init)
    }) as typeof fetch

    const { container } = await renderShell(
      <HostedShell
        initialLaunchRequest={{ apiBaseUrl: 'http://localhost:3100' }}
        initialError={null}
      />
    )
    const initialIframe = container.querySelector<HTMLIFrameElement>(
      'iframe[title="Hosted OpenSpec UI opsx-project"]'
    )
    expect(initialIframe).toBeTruthy()

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
    })

    expect(healthRequestCount).toBe(2)
    expect(
      container.querySelector<HTMLIFrameElement>('iframe[title="Hosted OpenSpec UI opsx-project"]')
    ).toBe(initialIframe)

    replacementHealth.resolve(await immediateFetch('http://localhost:3100/api/health'))
    await flushEffects()
    expect(
      container.querySelector<HTMLIFrameElement>('iframe[title="Hosted OpenSpec UI opsx-project"]')
    ).toBe(initialIframe)
  })

  it('renders the fixed Home pinned tab when no project backends are open', async () => {
    const { container } = await renderShell(
      <HostedShell initialLaunchRequest={null} fallbackLaunchRequest={null} initialError={null} />
    )
    // Home is a pinned, non-closeable tab that replaces the old empty shell state.
    expect(screen.getByText('Home')).toBeTruthy()
    expect(screen.getByText('Start from path')).toBeTruthy()
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
    expect(betaFrame?.closest('[data-tab-panel-state]')?.querySelector('.rt-skeleton')).toBeTruthy()
  })

  it('keeps each project tab bound to its own iframe session and runtime when switching tabs', async () => {
    localStorage.setItem(
      getHostedShellStorageKey(),
      JSON.stringify({
        activeTabId: 'session-alpha',
        tabs: [
          {
            id: 'session-alpha',
            sessionId: 'session-alpha',
            apiBaseUrl: 'http://localhost:3100',
            createdAt: 1,
          },
          {
            id: 'session-beta',
            sessionId: 'session-beta',
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

    await flushEffects()

    const alphaFrame = container.querySelector<HTMLIFrameElement>(
      'iframe[title="Hosted OpenSpec UI alpha"]'
    )
    const betaFrame = container.querySelector<HTMLIFrameElement>(
      'iframe[title="Hosted OpenSpec UI beta"]'
    )
    expect(alphaFrame?.src).toContain(
      'http://localhost:3100/dashboard?api=http%3A%2F%2Flocalhost%3A3100&session=session-alpha'
    )
    expect(betaFrame?.src).toContain(
      'http://localhost:3200/dashboard?api=http%3A%2F%2Flocalhost%3A3200&session=session-beta'
    )

    const alphaPanel = alphaFrame?.closest('[data-tab-panel-state]')
    const betaPanel = betaFrame?.closest('[data-tab-panel-state]')
    expect(alphaPanel?.getAttribute('data-tab-panel-state')).toBe('active')
    expect(betaPanel?.getAttribute('data-tab-panel-state')).toBe('inactive')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /beta.*\/tmp\/beta/i }))
    })

    expect(alphaFrame?.src).toContain('session=session-alpha')
    expect(betaFrame?.src).toContain('session=session-beta')
    expect(alphaPanel?.getAttribute('data-tab-panel-state')).toBe('inactive')
    expect(betaPanel?.getAttribute('data-tab-panel-state')).toBe('active')
    expect(document.title).toBe('beta - OpenSpec UI App')
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
    expect(container.querySelectorAll('[data-hosted-reachability="offline"]')).toHaveLength(2)
  })
})
