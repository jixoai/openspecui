/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Classify hosted backend transport, authentication, and protocol reachability.
 * 2. Send only the runtime credential bound to the probed normalized API locator.
 * 3. Decode successful health JSON before capability and embedded-URL compatibility checks.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
 * Delivery correction (2026-07-24): 401/403 is authentication-required rather than offline.
 */
import { isSupportedEmbeddedUiUrl } from '@openspecui/core/hosted-app'
import {
  HostedBackendContractError,
  HostedBackendHealthResponseSchema,
  OPENSPECUI_RUNTIME_CAPABILITIES,
  type HostedBackendHealthResponse,
} from '@openspecui/core/hosted-contract'
import { readLaunchCredential } from './launch-credential'

export type HostedTabReachability =
  | 'checking'
  | 'online'
  | 'offline'
  | 'unsupported'
  | 'authentication-required'

export interface HostedBackendProbeResult {
  reachability: HostedTabReachability
  health: HostedBackendHealthResponse | null
  errorMessage: string | null
  /** Present only when a successful health response violated the hosted contract. */
  contractError?: HostedBackendContractError | null
}

function unsupportedHealthContract(error: HostedBackendContractError): HostedBackendProbeResult {
  return {
    reachability: 'unsupported',
    health: null,
    errorMessage: 'Backend health response violates the hosted shell contract.',
    contractError: error,
  }
}

function hasRequiredRuntimeCapabilities(
  capabilities: HostedBackendHealthResponse['runtimeCapabilities']
): boolean {
  const observed = new Set(capabilities)
  return OPENSPECUI_RUNTIME_CAPABILITIES.every((capability) => observed.has(capability))
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
    const credential = readLaunchCredential(apiBaseUrl)
    const response = await fetchImpl(`${apiBaseUrl}/api/health`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      },
      mode: 'cors',
      signal: controller?.signal,
    })

    if (response.status === 401 || response.status === 403) {
      return {
        reachability: 'authentication-required',
        health: null,
        errorMessage:
          'Backend is reachable but requires a valid launch credential. Relaunch from the backend.',
        contractError: null,
      }
    }

    if (!response.ok) {
      return {
        reachability: 'offline',
        health: null,
        errorMessage: null,
        contractError: null,
      }
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      return unsupportedHealthContract(
        new HostedBackendContractError('Malformed hosted health JSON response.', { cause: error })
      )
    }
    const decoded = HostedBackendHealthResponseSchema.safeParse(payload)
    if (!decoded.success) {
      return unsupportedHealthContract(
        new HostedBackendContractError('Malformed hosted health contract response.', {
          cause: decoded.error,
        })
      )
    }
    const health = decoded.data
    if (!hasRequiredRuntimeCapabilities(health.runtimeCapabilities)) {
      // A backend that does not satisfy the required protocol version (or omits required runtime
      // metadata) is unsupported: the App must not treat it as a usable online environment.
      return {
        reachability: 'unsupported',
        health: null,
        errorMessage:
          'Backend protocol version or runtime metadata is unsupported by this hosted shell.',
        contractError: null,
      }
    }

    if (!isSupportedEmbeddedUiUrl(health.embeddedUiUrl)) {
      return {
        reachability: 'unsupported',
        health: null,
        errorMessage: 'Backend embedded UI URL is not supported by the hosted shell.',
        contractError: null,
      }
    }

    return {
      reachability: 'online',
      health,
      errorMessage: null,
      contractError: null,
    }
  } catch {
    return {
      reachability: 'offline',
      health: null,
      errorMessage: null,
      contractError: null,
    }
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}
