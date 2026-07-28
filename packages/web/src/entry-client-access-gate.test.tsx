/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove the real Project Web entry consumes a root-route launch credential before App-owned navigation and network owners initialize.
 * 2. Prove admission completes before the App-owned root-route canonicalization runs.
 *
 * Original request (2026-07-26): "行，那你现在把要修复的代码和测试先写完，完成后我再测试。"
 * Defect evidence (2026-07-26): App-normalized `/dashboard` requests omitted Authorization after the
 * root-route fragment disappeared before `entry-client` could consume it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reactDom = vi.hoisted(() => ({
  render: vi.fn(),
}))

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: reactDom.render })),
  hydrateRoot: vi.fn(),
}))

vi.mock('./App', async () => {
  // Keep the real App-owned navigation side effect that canonicalizes `/`.
  await import('./lib/nav-controller')
  return { App: () => null }
})

vi.mock('./components/hosted-connection-state', () => ({
  HostedConnectionState: () => null,
}))

interface ObservedRequest {
  url: string
  authorization: string | null
}

describe('Project Web entry Access Gate bootstrap', () => {
  const requests: ObservedRequest[] = []

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requests.length = 0
    document.body.innerHTML = '<div id="root"></div>'
    window.history.replaceState(
      {},
      '',
      '/?api=http%3A%2F%2Flocalhost%3A3111&session=entry-test#credential=entry-secret'
    )

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

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : null
        const url = request?.url ?? String(input)
        requests.push({
          url,
          authorization: new Headers(init?.headers ?? request?.headers).get('Authorization'),
        })
        if (url.endsWith('/api/health')) {
          return Response.json({ projectDir: '/tmp/entry-test' })
        }
        throw new Error('Entry bootstrap capture-only transport')
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    })
    document.body.innerHTML = ''
    window.history.replaceState({}, '', '/')
  })

  it('authorizes the first App-owned request from a root-route private launch', async () => {
    await import('./entry-client')

    await vi.waitFor(() => {
      expect(requests.find((request) => request.url.endsWith('/api/health'))).toEqual({
        url: 'http://localhost:3111/api/health',
        authorization: 'Bearer entry-secret',
      })
      expect(window.location.pathname).toBe('/dashboard')
    })
    expect(window.location.hash).toBe('')
    expect(window.location.href).not.toContain('entry-secret')
  })
})
