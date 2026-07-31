/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Parse and sanitize hosted launch URLs before App routing.
 * 2. Bind fragment credentials to the parsed normalized API locator before URL stripping.
 * 3. Capture the native App presentation declaration before client routing can replace its URL.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Delivery correction (2026-07-24): launch credential ownership is locator-scoped and ordering-safe.
 * Owner correction (2026-07-30): retain the native App presentation independently from route URLs.
 * Owner correction (2026-07-31): PWA and service-worker bootstrapping are retired.
 */
import { consumeLaunchCredential } from './launch-credential'
import { normalizeHostedApiBaseUrl, type HostedShellLaunchRequest } from './shell-state'

export interface HostedLaunchParseResult {
  request: HostedShellLaunchRequest | null
  error: string | null
  hasLaunchParams: boolean
}

/** Read the private one-shot host declaration carried by the native daemon presenter. */
export function parseHostedAppPresentation(search: string): 'opentray-overlay' | undefined {
  return new URLSearchParams(search).get('appMode') === 'opentray-overlay'
    ? 'opentray-overlay'
    : undefined
}

export function parseHostedLaunchParams(search: string): HostedLaunchParseResult {
  const params = new URLSearchParams(search)
  const rawApi = params.get('api')?.trim() ?? ''

  if (rawApi.length === 0) {
    return {
      request: null,
      error: null,
      hasLaunchParams: false,
    }
  }

  const apiBaseUrl = normalizeHostedApiBaseUrl(rawApi)
  if (!apiBaseUrl) {
    return {
      request: null,
      error: `Invalid hosted backend URL: ${rawApi}`,
      hasLaunchParams: true,
    }
  }

  return {
    request: {
      apiBaseUrl,
    },
    error: null,
    hasLaunchParams: true,
  }
}

export function stripHostedLaunchParams(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('version')
  url.searchParams.delete('api')
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Parse one complete launch URL, bind its credential before removing locator state, and optionally replace
 * the visible URL with the credential-free relative location.
 */
export function consumeHostedLaunchUrl(
  href: string,
  replaceState?: (url: string) => void
): HostedLaunchParseResult {
  const url = new URL(href)
  const launch = parseHostedLaunchParams(url.search)
  const credential = consumeLaunchCredential({
    apiBaseUrl: launch.request?.apiBaseUrl,
    hash: url.hash,
  })

  url.searchParams.delete('version')
  url.searchParams.delete('api')
  url.hash = credential.sanitizedHash

  if (launch.hasLaunchParams || credential.status !== 'absent') {
    replaceState?.(`${url.pathname}${url.search}${url.hash}`)
  }

  const credentialError = credential.status === 'configuration-error' ? credential.error : null
  return {
    ...launch,
    error: [launch.error, credentialError].filter((message) => message !== null).join(' ') || null,
  }
}
