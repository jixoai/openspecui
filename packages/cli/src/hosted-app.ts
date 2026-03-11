import { buildHostedLaunchUrl, resolveHostedAppBaseUrl } from '@openspecui/core'

export function buildHostedAppLaunchUrl(options: { baseUrl: string; apiBaseUrl: string }): string {
  return buildHostedLaunchUrl({
    baseUrl: options.baseUrl,
    apiBaseUrl: options.apiBaseUrl,
  })
}

export function resolveEffectiveHostedAppBaseUrl(options: {
  override?: string | null
  configured?: string | null
}): string {
  return resolveHostedAppBaseUrl(options)
}
