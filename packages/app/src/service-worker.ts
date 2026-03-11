/// <reference lib="webworker" />
import type { HostedAppVersionManifest } from '@openspecui/core/hosted-app'
import {
  buildChannelCacheName,
  renderServiceWorkerError,
  resolveChannelIdFromPathname,
  resolveVersionedNavigationShell,
} from './lib/service-worker-routing'

declare const self: ServiceWorkerGlobalScope

const APP_CACHE_NAME = 'openspecui-app:shell'
const MANIFEST_CACHE_NAME = 'openspecui-app:manifest'

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

async function fetchManifest(): Promise<HostedAppVersionManifest> {
  const request = new Request('/version.json', { cache: 'no-store' })
  const response = await staleWhileRevalidate(MANIFEST_CACHE_NAME, request)
  if (!response.ok) {
    throw new Error(`Failed to fetch version.json: ${response.status}`)
  }
  return (await response.json()) as HostedAppVersionManifest
}

async function handleVersionNavigation(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url)
  const manifest = await fetchManifest()
  const channel = resolveVersionedNavigationShell(manifest, requestUrl)
  if (!channel) {
    return fetch(request)
  }

  const shellUrl = new URL(channel.shellPath, requestUrl.origin)
  try {
    return await staleWhileRevalidate(buildChannelCacheName(channel), shellUrl)
  } catch (error) {
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
      const manifest = await fetchManifest().catch(() => null)
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
    event.respondWith(staleWhileRevalidate(MANIFEST_CACHE_NAME, request))
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
