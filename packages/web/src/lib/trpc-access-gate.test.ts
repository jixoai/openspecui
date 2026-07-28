/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove the production tRPC HTTP link consumes a launch fragment and supplies Authorization.
 * 2. Prove the production tRPC WebSocket owner supplies the same credential as connection params.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class TrpcMockWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: TrpcMockWebSocket[] = []

  readonly url: string
  readonly sent: string[] = []
  readyState = TrpcMockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null

  constructor(url: string | URL) {
    super()
    this.url = String(url)
    TrpcMockWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(String(data))
  }

  close(): void {
    this.readyState = TrpcMockWebSocket.CLOSED
    this.dispatchEvent(new Event('close'))
    this.onclose?.()
  }

  open(): void {
    this.readyState = TrpcMockWebSocket.OPEN
    this.dispatchEvent(new Event('open'))
    this.onopen?.()
  }
}

function readAuthorization(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get('Authorization')
}

describe('Project Web tRPC Access Gate suppliers', () => {
  beforeEach(() => {
    vi.resetModules()
    TrpcMockWebSocket.instances = []
    window.history.replaceState({}, '', '/dashboard#credential=browser-secret')
    vi.stubGlobal('WebSocket', TrpcMockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
  })

  it('supplies Authorization through the actual HTTP batch link', async () => {
    let observedAuthorization: string | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        observedAuthorization = readAuthorization(init)
        throw new Error('capture-only transport')
      })
    )

    const { trpcClient } = await import('./trpc')
    await trpcClient.system.status.query().catch(() => undefined)

    expect(observedAuthorization).toBe('Bearer browser-secret')
    expect(window.location.hash).toBe('')
  })

  it('supplies Authorization connection params through the actual WebSocket client owner', async () => {
    const { getOrCreateWsClientInstance } = await import('./trpc')
    getOrCreateWsClientInstance()

    const socket = TrpcMockWebSocket.instances[0]
    expect(socket).toBeDefined()
    expect(socket?.url).toContain('connectionParams=1')
    socket?.open()

    await vi.waitFor(() => {
      expect(socket?.sent.map((value) => JSON.parse(value) as unknown)).toContainEqual({
        method: 'connectionParams',
        data: { authorization: 'Bearer browser-secret' },
      })
    })
    expect(window.location.hash).toBe('')
  })
})
