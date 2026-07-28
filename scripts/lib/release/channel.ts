/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Validate package SemVer before release routing.
 * 2. Derive npm and GitHub prerelease channels from one version fact.
 * 3. Build the canonical Changesets package tag.
 *
 * Original request (2026-07-28): "我想先发布一个beta版本"
 */

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const NPM_PRERELEASE_CHANNEL_PATTERN = /^[a-z][a-z0-9-]*$/

export type ReleaseChannel = {
  distTag: string
  prerelease: boolean
}

function parsePrereleaseIdentifiers(version: string): string[] | null {
  const match = SEMVER_PATTERN.exec(version)
  if (!match) {
    throw new Error(`Invalid SemVer release version: ${version}`)
  }

  const prerelease = match[4]
  if (!prerelease) return null

  const identifiers = prerelease.split('.')
  for (const identifier of identifiers) {
    if (/^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0')) {
      throw new Error(`Invalid numeric prerelease identifier in version: ${version}`)
    }
  }
  return identifiers
}

export function resolveReleaseChannel(version: string): ReleaseChannel {
  const identifiers = parsePrereleaseIdentifiers(version)
  if (!identifiers) {
    return { distTag: 'latest', prerelease: false }
  }

  const channel = identifiers[0]!
  if (!NPM_PRERELEASE_CHANNEL_PATTERN.test(channel) || channel === 'latest') {
    throw new Error(
      `Prerelease version '${version}' does not start with a safe npm channel identifier.`
    )
  }

  return { distTag: channel, prerelease: true }
}

export function getPackageReleaseTag(packageName: string, version: string): string {
  resolveReleaseChannel(version)
  return `${packageName}@${version}`
}
