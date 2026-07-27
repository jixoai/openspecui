/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove live Project Web admission reaches a terminal state before App transport imports.
 * 2. Keep valid, authentication, recoverable failure, and static bootstrap paths distinct.
 *
 * Owner-reported defect (2026-07-27): missing or invalid credentials leave Project Web loading
 * while tRPC, WebSocket, and PTY owners repeatedly report unauthorized failures.
 */
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spies = vi.hoisted(() => ({
  appImported: vi.fn(),
  createRoot: vi.fn(),
  hydrateRoot: vi.fn(),
  render: vi.fn(),
  staticMode: false,
}))

vi.mock('react-dom/client', () => ({
  createRoot: spies.createRoot.mockImplementation(() => ({ render: spies.render })),
  hydrateRoot: spies.hydrateRoot,
}))

vi.mock('./App', () => {
  spies.appImported()
  return { App: () => null }
})

vi.mock('./lib/static-mode', () => ({
  detectStaticMode: vi.fn(async () => spies.staticMode),
  setStaticMode: vi.fn(),
}))

function renderedPresentation(): {
  title?: string
  message?: string
  onRetry?: () => void
} {
  const element = spies.render.mock.calls.at(-1)?.[0] as
    | ReactElement<{ title?: string; message?: string; onRetry?: () => void }>
    | undefined
  if (!element) throw new Error('Project Web entry rendered no presentation.')
  return element.props
}

function installServiceWorker(): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: {},
      ready: Promise.resolve({}),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      register: vi.fn(async () => ({})),
    },
  })
}

describe('Project Web entry admission', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    spies.staticMode = false
    document.body.innerHTML = '<div id="root"></div>'
    window.history.replaceState(
      {},
      '',
      '/?api=http%3A%2F%2Flocalhost%3A3111&session=admission-test'
    )
    delete window.__OPENSPEC_STATIC_MODE__
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    })
    document.body.innerHTML = ''
    window.history.replaceState({}, '', '/')
    delete window.__OPENSPEC_STATIC_MODE__
  })

  it.each([
    { label: 'missing', hash: '', status: 401 },
    { label: 'invalid', hash: '#credential=invalid', status: 403 },
  ])('stops $label credentials before importing App transports', async ({ hash, status }) => {
    if (hash) installServiceWorker()
    window.history.replaceState(
      {},
      '',
      `/?api=http%3A%2F%2Flocalhost%3A3111&session=admission-test${hash}`
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status }))
    )

    await import('./entry-client')
    await vi.waitFor(() => expect(spies.render).toHaveBeenCalledTimes(1))

    expect(renderedPresentation()).toMatchObject({ title: 'Authentication Required' })
    expect(spies.appImported).not.toHaveBeenCalled()
  })

  it('imports App only after a successful protected health admission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ projectDir: '/tmp/project-a' }))
    )

    await import('./entry-client')
    await vi.waitFor(() => expect(spies.appImported).toHaveBeenCalledTimes(1))

    expect(spies.render).toHaveBeenCalledTimes(1)
  })

  it.each([
    { label: 'network failure', reply: () => Promise.reject(new Error('backend offline')) },
    {
      label: 'server rejection',
      reply: () => Promise.resolve(new Response(null, { status: 503, statusText: 'Unavailable' })),
    },
  ])('renders a recoverable $label before importing App', async ({ reply }) => {
    vi.stubGlobal('fetch', vi.fn(reply))

    await import('./entry-client')
    await vi.waitFor(() => expect(spies.render).toHaveBeenCalledTimes(1))

    expect(renderedPresentation()).toMatchObject({
      title: 'Project Web Unavailable',
      onRetry: expect.any(Function),
    })
    expect(spies.appImported).not.toHaveBeenCalled()
  })

  it('performs no admission request for an explicit static document', async () => {
    spies.staticMode = true
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    window.history.replaceState({}, '', '/')

    await import('./entry-client')
    await vi.waitFor(() => expect(spies.render).toHaveBeenCalledTimes(1))

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
