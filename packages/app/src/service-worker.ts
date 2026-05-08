/// <reference lib="webworker" />

type HostedServiceWorkerGlobalScope = ServiceWorkerGlobalScope

const sw = self as unknown as HostedServiceWorkerGlobalScope

const APP_SHELL_CACHE = `openspecui-app-shell-${__OPENSPECUI_APP_SHELL_REVISION__}`
const APP_SHELL_PATHS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/icon.svg',
  '/icon.dark.svg',
  '/icon.rounded.svg',
  '/logo.svg',
] as const

async function cacheShellAssets(): Promise<void> {
  const cache = await caches.open(APP_SHELL_CACHE)
  await cache.addAll(APP_SHELL_PATHS)
}

sw.addEventListener('install', ((event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      await cacheShellAssets().catch(() => {})
      await sw.skipWaiting()
    })()
  )
}) as EventListener)

sw.addEventListener('activate', ((event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== APP_SHELL_CACHE)
          .map((cacheName) => caches.delete(cacheName))
      )
      await sw.clients.claim()
    })()
  )
}) as EventListener)

sw.addEventListener('message', ((event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void sw.skipWaiting()
  }
}) as EventListener)

sw.addEventListener('fetch', ((event: FetchEvent) => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== sw.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_SHELL_CACHE)
        const cached = await cache.match('/index.html')
        if (cached) {
          return cached
        }
        return fetch(request)
      })()
    )
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
    url.pathname === '/logo.svg' ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_SHELL_CACHE)
        const cached = await cache.match(request)
        if (cached) {
          return cached
        }

        const response = await fetch(request)
        if (response.ok) {
          await cache.put(request, response.clone())
        }
        return response
      })()
    )
  }
}) as EventListener)
