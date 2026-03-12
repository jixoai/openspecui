import {
  buildHostedVersionManifestUrl,
  isHostedAppVersionManifest,
  isHostedBackendHealthResponse,
  normalizeHostedAppBaseUrl,
  type HostedAppVersionManifest,
  type HostedBackendHealthResponse,
} from '@openspecui/core/hosted-app'

export type HostedTabReachability = 'checking' | 'online' | 'offline'

export interface HostedBackendProbeResult {
  reachability: HostedTabReachability
  health: HostedBackendHealthResponse | null
  errorMessage: string | null
}

interface FetchHostedAppManifestOptions {
  force?: boolean
}

const hostedManifestCache = new Map<string, HostedAppVersionManifest>()
const hostedManifestRequests = new Map<string, Promise<HostedAppVersionManifest>>()

function toRuntimeBaseUrl(location: Pick<Location, 'href'>): string {
  const url = new URL(location.href)
  url.hash = ''
  url.search = ''
  if (url.pathname.endsWith('/index.html')) {
    url.pathname = url.pathname.slice(0, -'/index.html'.length) || '/'
  }
  return normalizeHostedAppBaseUrl(url.toString())
}

export async function fetchHostedAppManifest(
  location: Pick<Location, 'href'>,
  fetchImpl: typeof fetch = fetch,
  options: FetchHostedAppManifestOptions = {}
): Promise<HostedAppVersionManifest> {
  const manifestUrl = buildHostedVersionManifestUrl(toRuntimeBaseUrl(location))

  if (options.force) {
    hostedManifestCache.delete(manifestUrl)
    hostedManifestRequests.delete(manifestUrl)
  }

  const cachedManifest = hostedManifestCache.get(manifestUrl)
  if (cachedManifest) {
    return cachedManifest
  }

  const pendingRequest = hostedManifestRequests.get(manifestUrl)
  if (pendingRequest) {
    return pendingRequest
  }

  const request = (async () => {
    const response = await fetchImpl(manifestUrl, {
      headers: { accept: 'application/json' },
      cache: 'default',
    })

    if (!response.ok) {
      throw new Error(`Failed to load hosted manifest: ${response.status} ${response.statusText}`)
    }

    const payload = await response.json()
    if (!isHostedAppVersionManifest(payload)) {
      throw new Error('Hosted manifest is invalid')
    }

    hostedManifestCache.set(manifestUrl, payload)
    return payload
  })()

  hostedManifestRequests.set(manifestUrl, request)

  try {
    return await request
  } finally {
    hostedManifestRequests.delete(manifestUrl)
  }
}

export async function probeHostedBackend(
  apiBaseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<HostedBackendProbeResult> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller
    ? setTimeout(() => {
        controller.abort()
      }, 3000)
    : null

  try {
    const response = await fetchImpl(`${apiBaseUrl}/api/health`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      mode: 'cors',
      signal: controller?.signal,
    })

    if (!response.ok) {
      return {
        reachability: 'offline',
        health: null,
        errorMessage: null,
      }
    }

    const payload = await response.json()
    if (!isHostedBackendHealthResponse(payload)) {
      return {
        reachability: 'online',
        health: null,
        errorMessage: 'Backend health payload is missing hosted metadata.',
      }
    }

    return {
      reachability: 'online',
      health: payload,
      errorMessage: null,
    }
  } catch {
    return {
      reachability: 'offline',
      health: null,
      errorMessage: null,
    }
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}
