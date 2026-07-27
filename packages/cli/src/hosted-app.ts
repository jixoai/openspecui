/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Resolve the effective hosted App deployment locator.
 * 2. Build public and private browser launch URLs without putting credentials in query state.
 *
 * Original request (2026-07-15): "把 --app 模式提上日程。"
 * Delivery correction (2026-07-24): launch credentials travel only in the private browser fragment.
 */
import { buildHostedLaunchUrl, resolveHostedAppBaseUrl } from '@openspecui/core'

export function buildHostedAppLaunchUrl(options: {
  baseUrl: string
  apiBaseUrl: string
  credential?: string | null
}): string {
  return buildHostedLaunchUrl({
    baseUrl: options.baseUrl,
    apiBaseUrl: options.apiBaseUrl,
    credential: options.credential,
  })
}

/** Build a Direct Web browser target. Callers must never print the credential-bearing result. */
export function buildDirectWebLaunchUrl(options: {
  baseUrl: string
  credential?: string | null
}): string {
  const url = new URL(options.baseUrl)
  if (options.credential) {
    const fragment = new URLSearchParams(url.hash.slice(1))
    fragment.set('credential', options.credential)
    url.hash = fragment.toString()
  }
  return url.toString()
}

export function resolveEffectiveHostedAppBaseUrl(options: {
  override?: string | null
  configured?: string | null
}): string {
  return resolveHostedAppBaseUrl(options)
}
