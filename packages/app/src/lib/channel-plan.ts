import type { HostedAppChannelKind } from '@openspecui/core/hosted-app'
import semver from 'semver'

export interface HostedChannelPlanEntry {
  id: string
  kind: HostedAppChannelKind
  selector: string
  resolvedVersion: string
  major: number
  minor?: number
}

const MIN_SUPPORTED_MAJOR = 2

function compareVersions(a: string, b: string): number {
  return semver.compare(a, b)
}

export function listSupportedStableVersions(versions: readonly string[]): string[] {
  return versions
    .filter((version) => {
      const parsed = semver.parse(version)
      return (
        parsed !== null && parsed.prerelease.length === 0 && parsed.major >= MIN_SUPPORTED_MAJOR
      )
    })
    .sort(compareVersions)
}

export function buildHostedChannelPlan(versions: readonly string[]): HostedChannelPlanEntry[] {
  const supported = listSupportedStableVersions(versions)
  if (supported.length === 0) {
    return []
  }

  const channels = new Map<string, HostedChannelPlanEntry>()
  const latestVersion = supported[supported.length - 1]
  const latestParsed = semver.parse(latestVersion)
  if (!latestParsed) return []

  channels.set('latest', {
    id: 'latest',
    kind: 'latest',
    selector: 'latest',
    resolvedVersion: latestVersion,
    major: latestParsed.major,
    minor: latestParsed.minor,
  })

  for (const version of supported) {
    const parsed = semver.parse(version)
    if (!parsed) continue

    const majorId = `v${parsed.major}`
    const currentMajor = channels.get(majorId)
    if (!currentMajor || semver.gt(version, currentMajor.resolvedVersion)) {
      channels.set(majorId, {
        id: majorId,
        kind: 'major',
        selector: `^${parsed.major}.0.0`,
        resolvedVersion: version,
        major: parsed.major,
      })
    }

    const minorId = `v${parsed.major}.${parsed.minor}`
    const currentMinor = channels.get(minorId)
    if (!currentMinor || semver.gt(version, currentMinor.resolvedVersion)) {
      channels.set(minorId, {
        id: minorId,
        kind: 'minor',
        selector: `~${parsed.major}.${parsed.minor}.0`,
        resolvedVersion: version,
        major: parsed.major,
        minor: parsed.minor,
      })
    }
  }

  return [...channels.values()].sort((left, right) => left.id.localeCompare(right.id))
}
