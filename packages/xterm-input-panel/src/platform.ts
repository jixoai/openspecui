export type HostPlatform = 'windows' | 'macos' | 'common'
export type PlatformMode = HostPlatform | 'auto'

export function detectHostPlatform(): HostPlatform {
  const platformSource = (
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    ?? navigator.platform
    ?? navigator.userAgent
  ).toLowerCase()

  if (platformSource.includes('mac')) return 'macos'
  if (platformSource.includes('win')) return 'windows'
  return 'common'
}
