// @vitest-environment jsdom

import { HOSTED_SHELL_PROTOCOL_VERSION } from '@openspecui/core/hosted-app'
import { act, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HostedShell } from './hosted-shell'

const originalFetch = global.fetch
const originalMatchMedia = window.matchMedia
const originalServiceWorker = navigator.serviceWorker
const originalShowModal = HTMLDialogElement.prototype.showModal
const originalClose = HTMLDialogElement.prototype.close

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
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getRegistration: vi.fn(async () => ({
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          waiting: {},
          update: vi.fn(async () => undefined),
        })),
      },
    })

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input)

      if (url.endsWith('/api/health')) {
        return new Response(
          JSON.stringify({
            status: 'ok',
            projectDir: '/tmp/demo',
            projectName: 'demo',
            watcherEnabled: true,
            openspecuiVersion: '3.0.1',
            hostedShellProtocolVersion: HOSTED_SHELL_PROTOCOL_VERSION,
            embeddedUiUrl: 'http://localhost:3000/dashboard',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      }

      return new Response('ok', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
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
    vi.restoreAllMocks()
  })

  it('surfaces the apply-update action after warming a newer deployment', async () => {
    await renderShell(
      <HostedShell
        initialLaunchRequest={{ apiBaseUrl: 'http://localhost:3000' }}
        fallbackLaunchRequest={null}
        initialError={null}
      />
    )

    await flushEffects(8)

    expect(screen.getByRole('button', { name: 'Apply app update' })).toBeTruthy()
  })
})
