/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove protected resources obtain authority only from their initiating Project Web client.
 * 2. Prove an authenticated window cannot lend authority to a missing or retired initiating client.
 *
 * Original request (2026-07-24): "Remove the Service Worker cross-client credential fallback."
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const CREDENTIAL_RESPONSE_TYPE = 'openspecui:access-gate-credential-response'

interface TestResourceClient {
  postMessage(message: unknown, transfer?: Transferable[]): void
}

interface TestResourceWorkerScope {
  location: Location
  addEventListener(
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void
}

function requireFetchListener(listener: EventListener | null): EventListener {
  if (!listener) throw new Error('Resource worker did not register a fetch listener.')
  return listener
}

describe('Access Gate resource worker client authority', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    Reflect.deleteProperty(self, 'clients')
  })

  it('does not borrow another window credential when the initiating client is absent', async () => {
    const workerScope = self as unknown as TestResourceWorkerScope
    let fetchListener: EventListener | null = null
    const authenticatedWindow = {
      postMessage(_message: unknown, transfer?: Transferable[]) {
        const replyPort = transfer?.[0]
        if (!(replyPort instanceof MessagePort)) {
          throw new Error('Expected a reply MessagePort.')
        }
        replyPort.postMessage({
          type: CREDENTIAL_RESPONSE_TYPE,
          authorization: 'Bearer another-window-secret',
        })
      },
    } satisfies TestResourceClient
    const clients = {
      get: vi.fn(async () => undefined),
      matchAll: vi.fn(async () => [authenticatedWindow]),
    }
    Object.defineProperty(self, 'clients', { configurable: true, value: clients })

    const nativeAddEventListener = workerScope.addEventListener.bind(workerScope)
    vi.spyOn(workerScope, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'fetch') {
        fetchListener = listener as EventListener
        return
      }
      nativeAddEventListener(type, listener, options)
    })

    const observedAuthorization: Array<string | null> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        observedAuthorization.push(request.headers.get('Authorization'))
        return new Response(null, { status: 401 })
      })
    )

    await import('./access-gate-resource-worker')
    const registeredFetchListener = requireFetchListener(fetchListener)

    let responsePromise: Promise<Response> | null = null
    const event = new Event('fetch')
    Object.defineProperties(event, {
      clientId: { value: '' },
      request: { value: new Request(`${self.location.origin}/api/file-preview/hash/index.html`) },
      respondWith: {
        value(response: Response | Promise<Response>) {
          responsePromise = Promise.resolve(response)
        },
      },
    })
    registeredFetchListener(event)
    const pendingResponse = responsePromise
    if (!pendingResponse)
      throw new Error('Resource worker did not respond to the protected request.')
    await pendingResponse

    expect(clients.get).not.toHaveBeenCalled()
    expect(clients.matchAll).not.toHaveBeenCalled()
    expect(observedAuthorization).toEqual([null])
  })

  it('does not borrow another window credential when a non-empty initiating client id is retired', async () => {
    const workerScope = self as unknown as TestResourceWorkerScope
    let fetchListener: EventListener | null = null
    const authenticatedWindow = {
      postMessage(_message: unknown, transfer?: Transferable[]) {
        const replyPort = transfer?.[0]
        if (!(replyPort instanceof MessagePort)) {
          throw new Error('Expected a reply MessagePort.')
        }
        replyPort.postMessage({
          type: CREDENTIAL_RESPONSE_TYPE,
          authorization: 'Bearer another-window-secret',
        })
      },
    } satisfies TestResourceClient
    const clients = {
      get: vi.fn(async () => undefined),
      matchAll: vi.fn(async () => [authenticatedWindow]),
    }
    Object.defineProperty(self, 'clients', { configurable: true, value: clients })

    const nativeAddEventListener = workerScope.addEventListener.bind(workerScope)
    vi.spyOn(workerScope, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'fetch') {
        fetchListener = listener as EventListener
        return
      }
      nativeAddEventListener(type, listener, options)
    })

    const observedAuthorization: Array<string | null> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        observedAuthorization.push(request.headers.get('Authorization'))
        return new Response(null, { status: 401 })
      })
    )

    await import('./access-gate-resource-worker')
    const registeredFetchListener = requireFetchListener(fetchListener)

    let responsePromise: Promise<Response> | null = null
    const event = new Event('fetch')
    Object.defineProperties(event, {
      clientId: { value: 'retired-client' },
      request: { value: new Request(`${self.location.origin}/api/file-preview/hash/index.html`) },
      respondWith: {
        value(response: Response | Promise<Response>) {
          responsePromise = Promise.resolve(response)
        },
      },
    })
    registeredFetchListener(event)
    const pendingResponse = responsePromise
    if (!pendingResponse)
      throw new Error('Resource worker did not respond to the protected request.')
    await pendingResponse

    expect(clients.get).toHaveBeenCalledWith('retired-client')
    expect(clients.matchAll).not.toHaveBeenCalled()
    expect(observedAuthorization).toEqual([null])
  })

  it('uses only the real initiating client credential when another window is also authenticated', async () => {
    const workerScope = self as unknown as TestResourceWorkerScope
    let fetchListener: EventListener | null = null
    const createClient = (authorization: string) =>
      ({
        postMessage(_message: unknown, transfer?: Transferable[]) {
          const replyPort = transfer?.[0]
          if (!(replyPort instanceof MessagePort)) {
            throw new Error('Expected a reply MessagePort.')
          }
          replyPort.postMessage({ type: CREDENTIAL_RESPONSE_TYPE, authorization })
        },
      }) satisfies TestResourceClient
    const initiatingClient = createClient('Bearer initiating-client-secret')
    const anotherWindow = createClient('Bearer another-window-secret')
    const clients = {
      get: vi.fn(async (clientId: string) =>
        clientId === 'initiating-client' ? initiatingClient : undefined
      ),
      matchAll: vi.fn(async () => [anotherWindow]),
    }
    Object.defineProperty(self, 'clients', { configurable: true, value: clients })

    const nativeAddEventListener = workerScope.addEventListener.bind(workerScope)
    vi.spyOn(workerScope, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'fetch') {
        fetchListener = listener as EventListener
        return
      }
      nativeAddEventListener(type, listener, options)
    })

    const observedAuthorization: Array<string | null> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        observedAuthorization.push(request.headers.get('Authorization'))
        return new Response(null, { status: 200 })
      })
    )

    await import('./access-gate-resource-worker')
    const registeredFetchListener = requireFetchListener(fetchListener)

    let responsePromise: Promise<Response> | null = null
    const event = new Event('fetch')
    Object.defineProperties(event, {
      clientId: { value: 'initiating-client' },
      request: { value: new Request(`${self.location.origin}/api/file-preview/hash/index.html`) },
      respondWith: {
        value(response: Response | Promise<Response>) {
          responsePromise = Promise.resolve(response)
        },
      },
    })
    registeredFetchListener(event)
    const pendingResponse = responsePromise
    if (!pendingResponse)
      throw new Error('Resource worker did not respond to the protected request.')
    await pendingResponse

    expect(clients.get).toHaveBeenCalledWith('initiating-client')
    expect(clients.matchAll).not.toHaveBeenCalled()
    expect(observedAuthorization).toEqual(['Bearer initiating-client-secret'])
  })
})
