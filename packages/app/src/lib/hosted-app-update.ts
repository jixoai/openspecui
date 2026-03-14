import {
  buildHostedVersionManifestUrl,
  isHostedAppVersionManifest,
  normalizeHostedAppBaseUrl,
  type HostedAppVersionManifest,
} from '@openspecui/core/hosted-app'
import {
  buildAppShellCacheName,
  buildChannelCacheName,
  isManagedHostedCacheName,
  listManagedHostedCacheNames,
  MANIFEST_CACHE_NAME,
} from './hosted-app-caches'
import { hasVersionedNavigationShellMarker } from './service-worker-routing'

const APP_SHELL_STATIC_PATHS = [
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

interface CacheLike {
  match(request: RequestInfo | URL): Promise<Response | undefined>
  put(request: RequestInfo | URL, response: Response): Promise<void>
}

interface CacheStorageLike {
  delete(cacheName: string): Promise<boolean>
  keys(): Promise<string[]>
  open(cacheName: string): Promise<CacheLike>
}

function toRuntimeBaseUrl(location: Pick<Location, 'href'>): string {
  const url = new URL(location.href)
  url.hash = ''
  url.search = ''
  if (url.pathname.endsWith('/index.html')) {
    url.pathname = url.pathname.slice(0, -'/index.html'.length) || '/'
  }
  return normalizeHostedAppBaseUrl(url.toString())
}

function getVersionedIndexAliasUrl(baseUrl: string, channelId: string): string {
  return new URL(`/versions/${channelId}/index.html`, baseUrl).toString()
}

function uniqueUrls(urls: Iterable<string>): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const url of urls) {
    if (seen.has(url)) {
      continue
    }
    seen.add(url)
    next.push(url)
  }
  return next
}

export function collectTargetChannelIds(
  manifest: HostedAppVersionManifest,
  resolvedChannelIds: readonly string[]
): string[] {
  const channels = new Set<string>()
  if (manifest.channels[manifest.defaultChannel]) {
    channels.add(manifest.defaultChannel)
  }
  for (const channelId of resolvedChannelIds) {
    if (manifest.channels[channelId]) {
      channels.add(channelId)
    }
  }
  return Array.from(channels)
}

export function hasHostedDeploymentUpdate(
  currentManifest: HostedAppVersionManifest,
  nextManifest: HostedAppVersionManifest,
  targetChannelIds: readonly string[]
): boolean {
  if (currentManifest.generatedAt !== nextManifest.generatedAt) {
    return true
  }

  for (const channelId of targetChannelIds) {
    const currentChannel = currentManifest.channels[channelId]
    const nextChannel = nextManifest.channels[channelId]
    if (!currentChannel || !nextChannel) {
      return true
    }
    if (
      currentChannel.resolvedVersion !== nextChannel.resolvedVersion ||
      currentChannel.rootPath !== nextChannel.rootPath ||
      currentChannel.shellPath !== nextChannel.shellPath
    ) {
      return true
    }
  }

  return false
}

export function extractDocumentAssetUrls(documentUrl: string, html: string): string[] {
  const urls = new Set<string>()
  const baseUrl = new URL(documentUrl)
  const matcher = /\b(?:src|href)=["']([^"']+)["']/g

  for (const match of html.matchAll(matcher)) {
    const candidate = match[1]?.trim()
    if (!candidate) {
      continue
    }

    try {
      const resolved = new URL(candidate, baseUrl)
      resolved.hash = ''
      if (resolved.origin !== baseUrl.origin) {
        continue
      }
      urls.add(resolved.toString())
    } catch {
      // Ignore malformed URLs inside HTML.
    }
  }

  return Array.from(urls)
}

async function warmUrl(options: {
  allowReuse: boolean
  cacheName: string
  cacheStorage: CacheStorageLike
  fetchImpl?: typeof fetch
  url: string
}): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch
  const request = new Request(options.url)
  const cache = await options.cacheStorage.open(options.cacheName)
  const cached = await cache.match(request)
  if (cached) {
    return cached.clone()
  }

  if (options.allowReuse) {
    for (const cacheName of await options.cacheStorage.keys()) {
      if (cacheName === options.cacheName || !isManagedHostedCacheName(cacheName)) {
        continue
      }
      const sourceCache = await options.cacheStorage.open(cacheName)
      const match = await sourceCache.match(request)
      if (match) {
        await cache.put(request, match.clone())
        return match.clone()
      }
    }
  }

  const response = await fetchImpl(request, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to warm ${new URL(options.url).pathname}: ${response.status}`)
  }

  await cache.put(request, response.clone())
  return response
}

export async function refreshHostedManifestCache(
  location: Pick<Location, 'href'>,
  cacheStorage: CacheStorageLike,
  fetchImpl: typeof fetch = fetch
): Promise<HostedAppVersionManifest> {
  const baseUrl = toRuntimeBaseUrl(location)
  const manifestUrl = buildHostedVersionManifestUrl(baseUrl)
  const response = await fetchImpl(manifestUrl, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to load hosted manifest: ${response.status} ${response.statusText}`)
  }

  const payload = await response.clone().json()
  if (!isHostedAppVersionManifest(payload)) {
    throw new Error('Hosted manifest is invalid')
  }

  const manifestCache = await cacheStorage.open(MANIFEST_CACHE_NAME)
  await manifestCache.put(new Request(manifestUrl), response.clone())
  return payload
}

export async function warmHostedAppShell(
  manifest: HostedAppVersionManifest,
  location: Pick<Location, 'href'>,
  cacheStorage: CacheStorageLike,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const baseUrl = toRuntimeBaseUrl(location)
  const cacheName = buildAppShellCacheName(manifest.generatedAt)
  const shellUrl = new URL(baseUrl).toString()
  const shellResponse = await warmUrl({
    allowReuse: false,
    cacheName,
    cacheStorage,
    fetchImpl,
    url: shellUrl,
  })

  const cache = await cacheStorage.open(cacheName)
  const shellHtml = await shellResponse.clone().text()
  const rootUrl = new URL('/', shellUrl).toString()
  const indexUrl = new URL('/index.html', shellUrl).toString()
  await cache.put(new Request(rootUrl), shellResponse.clone())
  await cache.put(new Request(indexUrl), shellResponse.clone())

  const extraUrls = uniqueUrls([
    ...APP_SHELL_STATIC_PATHS.map((pathname) => new URL(pathname, shellUrl).toString()),
    ...extractDocumentAssetUrls(shellResponse.url || shellUrl, shellHtml),
  ]).filter((url) => url !== rootUrl && url !== indexUrl)

  await Promise.all(
    extraUrls.map((url) =>
      warmUrl({
        allowReuse: true,
        cacheName,
        cacheStorage,
        fetchImpl,
        url,
      })
    )
  )

  return cacheName
}

export async function warmHostedVersionChannels(
  manifest: HostedAppVersionManifest,
  channelIds: readonly string[],
  location: Pick<Location, 'href'>,
  cacheStorage: CacheStorageLike,
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  const baseUrl = toRuntimeBaseUrl(location)
  const warmedCacheNames: string[] = []

  for (const channelId of channelIds) {
    const channel = manifest.channels[channelId]
    if (!channel) {
      continue
    }

    const cacheName = buildChannelCacheName(channel)
    const shellUrl = new URL(channel.shellPath, baseUrl).toString()
    const shellResponse = await warmUrl({
      allowReuse: false,
      cacheName,
      cacheStorage,
      fetchImpl,
      url: shellUrl,
    })
    const shellHtml = await shellResponse.clone().text()
    if (!hasVersionedNavigationShellMarker(channel.id, shellHtml)) {
      throw new Error(`Channel ${channel.id} returned an unexpected shell document.`)
    }

    const cache = await cacheStorage.open(cacheName)
    await cache.put(new Request(shellUrl), shellResponse.clone())
    await cache.put(
      new Request(getVersionedIndexAliasUrl(baseUrl, channel.id)),
      shellResponse.clone()
    )

    const assetUrls = uniqueUrls(
      extractDocumentAssetUrls(shellResponse.url || shellUrl, shellHtml)
    ).filter((url) => url !== shellUrl)

    await Promise.all(
      assetUrls.map((url) =>
        warmUrl({
          allowReuse: true,
          cacheName,
          cacheStorage,
          fetchImpl,
          url,
        })
      )
    )

    warmedCacheNames.push(cacheName)
  }

  return warmedCacheNames
}

export async function collectStaleHostedCacheNames(
  cacheStorage: CacheStorageLike,
  manifest: HostedAppVersionManifest
): Promise<string[]> {
  const keep = new Set(listManagedHostedCacheNames(manifest))
  const cacheNames = await cacheStorage.keys()
  return cacheNames.filter(
    (cacheName) => isManagedHostedCacheName(cacheName) && !keep.has(cacheName)
  )
}

export async function cleanupHostedCaches(
  cacheStorage: CacheStorageLike,
  cacheNames: readonly string[]
): Promise<void> {
  await Promise.all(cacheNames.map((cacheName) => cacheStorage.delete(cacheName)))
}

export function buildClaimedHostedCacheNames(
  manifest: HostedAppVersionManifest,
  resolvedChannelIds: readonly string[]
): string[] {
  return uniqueUrls([
    buildAppShellCacheName(manifest.generatedAt),
    ...collectTargetChannelIds(manifest, resolvedChannelIds)
      .map((channelId) => manifest.channels[channelId])
      .filter((channel): channel is NonNullable<typeof channel> => channel !== undefined)
      .map((channel) => buildChannelCacheName(channel)),
  ])
}
