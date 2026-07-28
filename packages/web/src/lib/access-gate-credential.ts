/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Consume one Project Web launch credential from the fragment and remove it before rendering.
 * 2. Own the credential only in module memory and supply protected browser HTTP requests.
 * 3. Answer same-origin Service Worker resource requests without persistence or URL leakage.
 *
 * Original request (2026-07-15): "后端接口就必须带上这个 http header。"
 * Delivery correction (2026-07-24): one in-memory owner supplies HTTP, WS, PTY, and raw resources.
 */
import { ACCESS_GATE_CREDENTIAL_FRAGMENT_PARAM } from '@openspecui/core/hosted-app'
import { getApiBaseUrl } from './api-config'

export const ACCESS_GATE_CREDENTIAL_REQUEST = 'openspecui:access-gate-credential-request'
export const ACCESS_GATE_CREDENTIAL_RESPONSE = 'openspecui:access-gate-credential-response'

let credential: string | null = null
let credentialResponderInstalled = false

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined'
}

function sanitizeFragment(url: URL): boolean {
  const fragment = new URLSearchParams(url.hash.slice(1))
  const supplied = fragment.get(ACCESS_GATE_CREDENTIAL_FRAGMENT_PARAM)
  if (supplied === null) return false

  if (supplied.length > 0) credential = supplied
  fragment.delete(ACCESS_GATE_CREDENTIAL_FRAGMENT_PARAM)
  const remaining = fragment.toString()
  url.hash = remaining ? `#${remaining}` : ''
  return true
}

/** Consume and strip a launch credential. Repeated calls are idempotent for the current page. */
export function consumeAccessGateLaunchCredential(): string | null {
  if (!isBrowser()) return credential
  const url = new URL(window.location.href)
  if (sanitizeFragment(url)) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }
  return credential
}

/** Read the runtime-only raw credential, lazily consuming a fragment when necessary. */
export function getAccessGateCredential(): string | null {
  return consumeAccessGateLaunchCredential()
}

/** Build the header-shaped credential used by HTTP and tRPC WebSocket admission. */
export function getAccessGateAuthorization(): string | null {
  const value = getAccessGateCredential()
  return value ? `Bearer ${value}` : null
}

function isProtectedDataPath(pathname: string): boolean {
  return (
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/trpc' ||
    pathname.startsWith('/trpc/')
  )
}

function resolveRequestUrl(input: RequestInfo | URL): URL | null {
  if (!isBrowser()) return null
  const value =
    input instanceof Request ? input.url : input instanceof URL ? input.toString() : input
  try {
    return new URL(value, window.location.href)
  } catch {
    return null
  }
}

/** True only for protected paths at the configured Project Web backend origin. */
export function isAccessGateProtectedBrowserRequest(input: RequestInfo | URL): boolean {
  const url = resolveRequestUrl(input)
  if (!url || !isProtectedDataPath(url.pathname)) return false
  const apiBaseUrl = getApiBaseUrl()
  const backendOrigin = apiBaseUrl ? new URL(apiBaseUrl).origin : window.location.origin
  return url.origin === backendOrigin
}

/** Fetch while supplying the in-memory credential only to the matching protected backend. */
export function accessGateFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const authorization = getAccessGateAuthorization()
  if (!authorization || !isAccessGateProtectedBrowserRequest(input)) {
    return fetch(input, init)
  }
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  if (!headers.has('Authorization')) headers.set('Authorization', authorization)
  return fetch(input, { ...init, headers })
}

/** Install the page-side responder used by raw iframe/media/image requests intercepted by the SW. */
export function installAccessGateCredentialResponder(
  serviceWorker: Pick<ServiceWorkerContainer, 'addEventListener'> = navigator.serviceWorker
): void {
  if (credentialResponderInstalled) return
  credentialResponderInstalled = true
  serviceWorker.addEventListener('message', (event: Event) => {
    const message = event as MessageEvent<unknown>
    const data = message.data
    if (
      typeof data !== 'object' ||
      data === null ||
      (data as { type?: unknown }).type !== ACCESS_GATE_CREDENTIAL_REQUEST
    ) {
      return
    }
    const replyPort = message.ports[0]
    if (!replyPort) return
    replyPort.postMessage({
      type: ACCESS_GATE_CREDENTIAL_RESPONSE,
      authorization: getAccessGateAuthorization(),
    })
  })
}

async function waitForController(serviceWorker: ServiceWorkerContainer): Promise<void> {
  if (serviceWorker.controller) return
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      serviceWorker.removeEventListener('controllerchange', onControllerChange)
      reject(new Error('Access Gate resource worker did not take control.'))
    }, 5_000)
    const onControllerChange = () => {
      window.clearTimeout(timeout)
      serviceWorker.removeEventListener('controllerchange', onControllerChange)
      resolve()
    }
    serviceWorker.addEventListener('controllerchange', onControllerChange)
  })
}

/** Activate the transient resource-header bridge before protected UI content is rendered. */
export async function activateAccessGateResourceWorker(
  serviceWorker: ServiceWorkerContainer = navigator.serviceWorker
): Promise<void> {
  if (!getAccessGateCredential()) return
  installAccessGateCredentialResponder(serviceWorker)
  const scriptUrl = import.meta.env.DEV
    ? '/src/access-gate-resource-worker.ts'
    : '/access-gate-resource-worker.js'
  await serviceWorker.register(scriptUrl, { scope: '/', type: 'module' })
  await serviceWorker.ready
  await waitForController(serviceWorker)
}
