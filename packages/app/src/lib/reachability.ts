import {
  isBackendHealthRuntimeMetadata,
  isSupportedEmbeddedUiUrl,
  type HostedBackendHealthResponse,
} from '@openspecui/core/hosted-app'

export type HostedTabReachability = 'checking' | 'online' | 'offline' | 'unsupported'

export interface HostedBackendProbeResult {
  reachability: HostedTabReachability
  health: HostedBackendHealthResponse | null
  errorMessage: string | null
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
    if (!isBackendHealthRuntimeMetadata(payload)) {
      // A backend that does not satisfy the required protocol version (or omits required runtime
      // metadata) is unsupported: the App must not treat it as a usable online environment.
      return {
        reachability: 'unsupported',
        health: null,
        errorMessage:
          'Backend protocol version or runtime metadata is unsupported by this hosted shell.',
      }
    }

    if (!isSupportedEmbeddedUiUrl(payload.embeddedUiUrl)) {
      return {
        reachability: 'unsupported',
        health: null,
        errorMessage: 'Backend embedded UI URL is not supported by the hosted shell.',
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
