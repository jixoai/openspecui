/// <reference lib="webworker" />
import type {
  HostedAppChannelManifest,
  HostedAppVersionManifest,
} from '@openspecui/core/hosted-app'
import {
  buildChannelCacheName,
  buildVersionedNavigationShellUrl,
  renderServiceWorkerError,
  resolveChannelIdFromPathname,
  resolveVersionedNavigationShell,
} from './lib/service-worker-routing'

declare const self: ServiceWorkerGlobalScope

const APP_CACHE_NAME = 'openspecui-app:shell'
const MANIFEST_CACHE_NAME = 'openspecui-app:manifest'
const MANIFEST_REQUEST = new Request('/version.json')

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
    const response = await fetch(new Request('/version.json', { cache: 'no-store' }))
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
}

async function readCachedVersionedShellDocument(
  cacheName: string,
  shellUrl: URL
): Promise<Response | null> {
  const cache = await caches.open(cacheName)
  return (await cache.match(new Request(shellUrl.toString()))) ?? null
}

async function fetchVersionedNavigationFromNetwork(
  request: Request,
  shellUrl: URL,
  channel: HostedAppChannelManifest
): Promise<Response> {
  const requestUrl = new URL(request.url)
  const directResponse = await fetch(request)
  if (directResponse.ok) {
    await cacheVersionedShellDocument(buildChannelCacheName(channel), shellUrl, directResponse)
    return directResponse
  }

  if (requestUrl.pathname === shellUrl.pathname) {
    return directResponse
  }

  const shellResponse = await fetch(new Request(shellUrl.toString()))
  if (shellResponse.ok) {
    await cacheVersionedShellDocument(buildChannelCacheName(channel), shellUrl, shellResponse)
    return shellResponse
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

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
      const manifest = await refreshManifest().catch(() => null)
      if (!manifest) return
      const keep = new Set([
        APP_CACHE_NAME,
        MANIFEST_CACHE_NAME,
        ...Object.values(manifest.channels).map((channel) => buildChannelCacheName(channel)),
      ])
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.filter((name) => !keep.has(name)).map((name) => caches.delete(name))
      )
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
    event.respondWith(cacheFirst(MANIFEST_CACHE_NAME, MANIFEST_REQUEST))
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
    event.respondWith(staleWhileRevalidate(APP_CACHE_NAME, request))
  }
})
