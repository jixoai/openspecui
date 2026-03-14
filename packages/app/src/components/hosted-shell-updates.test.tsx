// @vitest-environment jsdom

import { act, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HostedShell } from './hosted-shell'

class MemoryCache {
  private readonly entries = new Map<string, Response>()

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(resolveRequestUrl(request))?.clone()
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(resolveRequestUrl(request), response.clone())
  }
}

class MemoryCacheStorage {
  private readonly caches = new Map<string, MemoryCache>()

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName)
  }

  async keys(): Promise<string[]> {
    return Array.from(this.caches.keys())
  }

  async open(cacheName: string): Promise<MemoryCache> {
    const existing = this.caches.get(cacheName)
    if (existing) {
      return existing
    }
    const next = new MemoryCache()
    this.caches.set(cacheName, next)
    return next
  }
}

const originalFetch = global.fetch
const originalMatchMedia = window.matchMedia
const originalServiceWorker = navigator.serviceWorker
const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close

const currentManifest = {
  packageName: 'openspecui' as const,
  generatedAt: '2026-03-13T00:00:00.000Z',
  defaultChannel: 'latest',
  channels: {
    latest: {
      id: 'latest',
      kind: 'latest' as const,
      selector: 'latest',
      resolvedVersion: '2.1.2',
      rootPath: '/versions/latest/',
      shellPath: '/versions/latest/',
      major: 2,
    },
  },
  compatibility: [],
}

const nextManifest = {
  ...currentManifest,
  generatedAt: '2026-03-14T00:00:00.000Z',
  channels: {
    latest: {
      ...currentManifest.channels.latest,
      resolvedVersion: '2.1.3',
    },
  },
}

function resolveRequestUrl(request: RequestInfo | URL): string {
  if (typeof request === 'string') {
    return new URL(request, window.location.href).toString()
  }
  if (request instanceof URL) {
    return request.toString()
  }
  return request.url
}

async function flushEffects(times = 6) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
  }
}

async function renderShell(
  element: ReactElement
): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(element)
  })
  await flushEffects()
  return { container, root }
}

describe('HostedShell updates', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
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
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: new MemoryCacheStorage(),
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn(async () => ({
          update: vi.fn(async () => undefined),
        })),
      },
    })

    let manifestRequests = 0
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input)

      if (url.endsWith('/version.json')) {
        manifestRequests += 1
        return new Response(
          JSON.stringify(manifestRequests === 1 ? currentManifest : nextManifest),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      }

      if (url === 'http://localhost:3000/' || url === 'http://localhost:3000/index.html') {
        return new Response(
          '<!doctype html><link rel="stylesheet" href="/assets/app.css"><script type="module" src="/assets/app.js"></script>',
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }
        )
      }

      if (
        url === 'http://localhost:3000/versions/latest/' ||
        url === 'http://localhost:3000/versions/latest/index.html'
      ) {
        return new Response(
          '<!doctype html><script>window.__OPENSPEC_BASE_PATH__ = \'/versions/latest/\'</script><script type="module" src="/versions/latest/assets/index.js"></script>',
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }
        )
      }

      return new Response('ok', {
        status: 200,
        headers: {
          'content-type': url.endsWith('.js')
            ? 'application/javascript; charset=utf-8'
            : url.endsWith('.css')
              ? 'text/css; charset=utf-8'
              : 'text/plain; charset=utf-8',
        },
      })
    }) as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    window.matchMedia = originalMatchMedia
    HTMLDialogElement.prototype.showModal = originalShowModal
    HTMLDialogElement.prototype.close = originalClose
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: originalServiceWorker,
    })
    Reflect.deleteProperty(globalThis, 'caches')
    vi.restoreAllMocks()
  })

  it('surfaces the apply-update action after warming a newer deployment', async () => {
    await renderShell(
      <HostedShell initialLaunchRequest={null} fallbackLaunchRequest={null} initialError={null} />
    )

    await flushEffects(8)

    expect(screen.getByRole('button', { name: 'Apply hosted app update' })).toBeTruthy()
  })
})
