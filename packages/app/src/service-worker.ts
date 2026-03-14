/// <reference lib="webworker" />
import type {
  HostedAppChannelManifest,
  HostedAppVersionManifest,
} from '@openspecui/core/hosted-app'
import {
  buildAppShellCacheName,
  buildChannelCacheName,
  MANIFEST_CACHE_NAME,
} from './lib/hosted-app-caches'
import {
  buildVersionedNavigationShellUrl,
  hasVersionedNavigationShellMarker,
  isVersionedNavigationShellResponse,
  renderServiceWorkerError,
  resolveChannelIdFromPathname,
  resolveVersionedNavigationShell,
} from './lib/service-worker-routing'

declare const self: ServiceWorkerGlobalScope

const MANIFEST_REQUEST = new Request(new URL('/version.json', self.location.origin).toString())

async function staleWhileRevalidate(cacheName: string, request: Request | URL): Promise<Response> {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const networkPromise = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone())
    }
    return response
  })

  if (cached) {
    void networkPromise.catch(() => {})
    return cached
  }

  return await networkPromise
}

async function cacheFirst(cacheName: string, request: Request | URL): Promise<Response> {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) {
    return cached
  }

  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
  }
  return response
}

function shouldBypassManifestCache(request: Request): boolean {
  return request.cache === 'no-store' || request.cache === 'reload'
}

async function parseManifestResponse(response: Response): Promise<HostedAppVersionManifest> {
  if (!response.ok) {
    throw new Error(`Failed to fetch version.json: ${response.status}`)
  }
  return (await response.json()) as HostedAppVersionManifest
}

async function fetchManifest(): Promise<HostedAppVersionManifest> {
  const response = await cacheFirst(MANIFEST_CACHE_NAME, MANIFEST_REQUEST)
  return parseManifestResponse(response)
}

async function refreshManifest(): Promise<HostedAppVersionManifest> {
  const cache = await caches.open(MANIFEST_CACHE_NAME)

  try {
    const response = await fetch(new Request(MANIFEST_REQUEST, { cache: 'no-store' }))
    if (!response.ok) {
      throw new Error(`Failed to fetch version.json: ${response.status}`)
    }
    await cache.put(MANIFEST_REQUEST, response.clone())
    return (await response.json()) as HostedAppVersionManifest
  } catch (error) {
    const cached = await cache.match(MANIFEST_REQUEST)
    if (cached) {
      return parseManifestResponse(cached)
    }
    throw error
  }
}

async function handleManifestRequest(request: Request): Promise<Response> {
  if (!shouldBypassManifestCache(request)) {
    return await cacheFirst(MANIFEST_CACHE_NAME, MANIFEST_REQUEST)
  }

  const cache = await caches.open(MANIFEST_CACHE_NAME)
  try {
    const response = await fetch(new Request(MANIFEST_REQUEST, { cache: 'no-store' }))
    if (response.ok) {
      await cache.put(MANIFEST_REQUEST, response.clone())
    }
    return response
  } catch (error) {
    const cached = await cache.match(MANIFEST_REQUEST)
    if (cached) {
      return cached
    }
    throw error
  }
}

async function cacheVersionedShellDocument(
  cacheName: string,
  shellUrl: URL,
  response: Response
): Promise<void> {
  if (!response.ok) {
    return
  }
  const cache = await caches.open(cacheName)
  await cache.put(new Request(shellUrl.toString()), response.clone())
  await cache.put(new Request(new URL('index.html', shellUrl).toString()), response.clone())
}

async function readCachedVersionedShellDocument(
  cacheName: string,
  shellUrl: URL
): Promise<Response | null> {
  const cache = await caches.open(cacheName)
  const canonical = await cache.match(new Request(shellUrl.toString()))
  if (canonical) {
    return canonical
  }
  return (await cache.match(new Request(new URL('index.html', shellUrl).toString()))) ?? null
}

async function isSafeVersionedNavigationResponse(
  channel: HostedAppChannelManifest,
  requestUrl: URL,
  response: Response
): Promise<boolean> {
  const looksLikeChannelResponse = isVersionedNavigationShellResponse(
    channel,
    requestUrl,
    response.url,
    response.headers.get('content-type')
  )
  if (!looksLikeChannelResponse) {
    return false
  }

  try {
    const content = await response.clone().text()
    return hasVersionedNavigationShellMarker(channel.id, content)
  } catch {
    return false
  }
}

async function fetchVersionedNavigationFromNetwork(
  request: Request,
  shellUrl: URL,
  channel: HostedAppChannelManifest
): Promise<Response> {
  const requestUrl = new URL(request.url)
  const cacheName = buildChannelCacheName(channel)
  const directResponse = await fetch(request)

  if (
    directResponse.ok &&
    (await isSafeVersionedNavigationResponse(channel, requestUrl, directResponse))
  ) {
    await cacheVersionedShellDocument(cacheName, shellUrl, directResponse)
    return directResponse
  }

  const shellResponse = await fetch(new Request(shellUrl.toString(), { cache: 'no-store' }))
  if (
    shellResponse.ok &&
    (await isSafeVersionedNavigationResponse(channel, shellUrl, shellResponse))
  ) {
    await cacheVersionedShellDocument(cacheName, shellUrl, shellResponse)
    return shellResponse
  }

  if (directResponse.ok || shellResponse.ok) {
    return renderServiceWorkerError(
      `Channel ${channel.id} resolved to an unexpected document.`,
      502
    )
  }

  return directResponse
}

async function handleVersionNavigation(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url)
  const manifest = await fetchManifest()
  const channel = resolveVersionedNavigationShell(manifest, requestUrl)
  if (!channel) {
    return fetch(request)
  }

  const shellUrl = buildVersionedNavigationShellUrl(channel, requestUrl)
  const cacheName = buildChannelCacheName(channel)

  try {
    const response = await fetchVersionedNavigationFromNetwork(request, shellUrl, channel)
    if (response.ok) {
      return response
    }

    const cached = await readCachedVersionedShellDocument(cacheName, shellUrl)
    return cached ?? response
  } catch (error) {
    const cached = await readCachedVersionedShellDocument(cacheName, shellUrl)
    if (cached) {
      return cached
    }

    return renderServiceWorkerError(
      error instanceof Error ? error.message : `Channel ${channel.id} is unavailable.`
    )
  }
}

async function handleVersionAsset(request: Request): Promise<Response> {
  const manifest = await fetchManifest().catch(() => null)
  if (!manifest) {
    return fetch(request)
  }

  const channelId = resolveChannelIdFromPathname(new URL(request.url).pathname)
  const channel = channelId ? manifest.channels[channelId] : null
  if (!channel) {
    return fetch(request)
  }

  return await staleWhileRevalidate(buildChannelCacheName(channel), request)
}

async function handleAppShellAsset(request: Request): Promise<Response> {
  const manifest = await fetchManifest().catch(() => null)
  if (!manifest) {
    return fetch(request)
  }

  return await staleWhileRevalidate(buildAppShellCacheName(manifest.generatedAt), request)
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
      await refreshManifest().catch(() => null)
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate' && url.pathname.startsWith('/versions/')) {
    event.respondWith(handleVersionNavigation(request))
    return
  }

  if (url.pathname === '/version.json') {
    event.respondWith(handleManifestRequest(request))
    return
  }

  if (url.pathname.startsWith('/versions/')) {
    event.respondWith(handleVersionAsset(request))
    return
  }

  if (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/pwa-192x192.png' ||
    url.pathname === '/pwa-512x512.png' ||
    url.pathname === '/icon.svg' ||
    url.pathname === '/icon.dark.svg' ||
    url.pathname === '/icon.rounded.svg' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/logo.svg'
  ) {
    event.respondWith(handleAppShellAsset(request))
  }
})
