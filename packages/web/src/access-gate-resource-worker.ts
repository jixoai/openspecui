/// <reference lib="webworker" />

/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Intercept only protected same-origin native GET resources.
 * 2. Request transient Authorization only from the Project Web client that initiated the fetch.
 * 3. Preserve missing/invalid credential rejection without caching authority.
 *
 * Original request (2026-07-24): "完整审计 Project Web 的 HTTP/tRPC WS/PTY/raw resource 网络路径。"
 */
import {
  authorizeResourceRequest,
  isProtectedResourceRequest,
} from './lib/access-gate-resource-request'

type AccessGateWorkerScope = ServiceWorkerGlobalScope
const worker = self as unknown as AccessGateWorkerScope
const REQUEST_TYPE = 'openspecui:access-gate-credential-request'
const RESPONSE_TYPE = 'openspecui:access-gate-credential-response'
const RESPONSE_TIMEOUT_MS = 500

function requestAuthorization(client: Client): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => resolve(null), RESPONSE_TIMEOUT_MS)
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      clearTimeout(timeout)
      const data = event.data
      if (
        typeof data === 'object' &&
        data !== null &&
        (data as { type?: unknown }).type === RESPONSE_TYPE &&
        typeof (data as { authorization?: unknown }).authorization === 'string'
      ) {
        resolve((data as { authorization: string }).authorization)
        return
      }
      resolve(null)
    }
    client.postMessage({ type: REQUEST_TYPE }, [channel.port2])
  })
}

async function resolveAuthorization(clientId: string): Promise<string | null> {
  if (!clientId) return null
  const initiatingClient = await worker.clients.get(clientId)
  if (!initiatingClient) return null
  return requestAuthorization(initiatingClient)
}

worker.addEventListener('install', ((event: ExtendableEvent) => {
  event.waitUntil(worker.skipWaiting())
}) as EventListener)

worker.addEventListener('activate', ((event: ExtendableEvent) => {
  event.waitUntil(worker.clients.claim())
}) as EventListener)

worker.addEventListener('fetch', ((event: FetchEvent) => {
  if (!isProtectedResourceRequest(event.request, worker.location.origin)) return
  event.respondWith(
    (async () => {
      const authorization = await resolveAuthorization(event.clientId)
      return fetch(
        authorization ? authorizeResourceRequest(event.request, authorization) : event.request
      )
    })()
  )
}) as EventListener)
