import type {
  HostedAppChannelManifest,
  HostedAppVersionManifest,
} from '@openspecui/core/hosted-app'

export const HOSTED_CACHE_PREFIX = 'openspecui-app:'
export const MANIFEST_CACHE_NAME = 'openspecui-app:manifest'
export const APP_SHELL_CACHE_PREFIX = 'openspecui-app:shell:'

export function buildAppShellCacheName(generatedAt: string): string {
  return `${APP_SHELL_CACHE_PREFIX}${generatedAt}`
}

export function buildChannelCacheName(channel: HostedAppChannelManifest): string {
  return `openspecui-app:${channel.id}:${channel.resolvedVersion}`
}

export function listManagedHostedCacheNames(manifest: HostedAppVersionManifest): string[] {
  return [
    MANIFEST_CACHE_NAME,
    buildAppShellCacheName(manifest.generatedAt),
    ...Object.values(manifest.channels).map((channel) => buildChannelCacheName(channel)),
  ]
}

export function isManagedHostedCacheName(name: string): boolean {
  return name.startsWith(HOSTED_CACHE_PREFIX)
}
