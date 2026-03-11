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
  fetchImpl: typeof fetch = fetch
): Promise<HostedAppVersionManifest> {
  const manifestUrl = buildHostedVersionManifestUrl(toRuntimeBaseUrl(location))
  const response = await fetchImpl(manifestUrl, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to load hosted manifest: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  if (!isHostedAppVersionManifest(payload)) {
    throw new Error('Hosted manifest is invalid')
  }

  return payload
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
