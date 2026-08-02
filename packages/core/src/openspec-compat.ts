/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Encode the shipped OpenSpecUI release line's OpenSpec CLI compatibility law.
 * 2. Classify adapted, unsupported, and unknown CLI versions.
 *
 * Original request (2026-07-15): "CLI 1.6 兼容性门禁。"
 * Original request (2026-07-31): "目前这个版本先给它支持1.7.*，因为基本兼容。"
 * Owner clarification (2026-07-31): "6.* 本身就是适配 1.6.*；对于 1.7 只是兼容而已。"
 * Original request (2026-08-01): "v7不兼容1.6.x，明确要求必须使用 v1.7.x。"
 */
export const OPENSPECUI_TARGET_MAJOR = 7
export const OPENSPEC_CLI_TARGET_SERIES = '1.7'
export const OPENSPEC_CLI_MIN_VERSION = '1.7.0'
export const OPENSPEC_CLI_TARGET_MIN_VERSION = '1.7.0'
export const OPENSPEC_CLI_RECOMMENDED_MIN_VERSION = '1.7.0'
export const OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION = '1.8.0'
export const OPENSPEC_CLI_ACCEPTED_RANGE = '>=1.7.0 <1.8.0'
export const OPENSPEC_CLI_RECOMMENDED_RANGE = OPENSPEC_CLI_ACCEPTED_RANGE
export const OPENSPEC_CLI_REFERENCE_TAG_PATTERN = 'v1.7.*'

export interface OpenSpecCliVersion {
  major: number
  minor: number
  patch: number
  prerelease: string | null
}

export type OpenSpecCliCompatibilityStatus = 'current' | 'unsupported' | 'unknown'

export interface OpenSpecCliCompatibility {
  rawVersion: string | undefined
  version: OpenSpecCliVersion | null
  status: OpenSpecCliCompatibilityStatus
  supported: boolean
  recommended: boolean
  blocksCoreInteractions: boolean
  message: string
}

export function parseOpenSpecCliVersion(raw: string | undefined): OpenSpecCliVersion | null {
  if (!raw) return null
  const match = raw.match(/(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  }
}

export function formatOpenSpecCliVersion(version: OpenSpecCliVersion): string {
  const stableVersion = `${version.major}.${version.minor}.${version.patch}`
  return version.prerelease ? `${stableVersion}-${version.prerelease}` : stableVersion
}

export function compareOpenSpecCliVersions(
  left: OpenSpecCliVersion,
  right: OpenSpecCliVersion
): number {
  if (left.major !== right.major) return left.major - right.major
  if (left.minor !== right.minor) return left.minor - right.minor
  return left.patch - right.patch
}

function isSeries(version: OpenSpecCliVersion, series: string): boolean {
  const [major, minor] = series.split('.').map((part) => Number(part))
  return version.major === major && version.minor === minor
}

function isCurrentRecommended(version: OpenSpecCliVersion): boolean {
  return version.prerelease === null && isSeries(version, OPENSPEC_CLI_TARGET_SERIES)
}

export function classifyOpenSpecCliVersion(
  rawVersion: string | undefined
): OpenSpecCliCompatibility {
  const version = parseOpenSpecCliVersion(rawVersion)

  if (!version) {
    return {
      rawVersion,
      version: null,
      status: 'unknown',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
      message: 'Unable to parse OpenSpec CLI version.',
    }
  }

  if (isCurrentRecommended(version)) {
    return {
      rawVersion,
      version,
      status: 'current',
      supported: true,
      recommended: true,
      blocksCoreInteractions: false,
      message: `OpenSpec CLI ${formatOpenSpecCliVersion(version)} matches the OpenSpecUI ${OPENSPECUI_TARGET_MAJOR}.x target line.`,
    }
  }

  return {
    rawVersion,
    version,
    status: 'unsupported',
    supported: false,
    recommended: false,
    blocksCoreInteractions: true,
    message: `Detected OpenSpec CLI ${formatOpenSpecCliVersion(version)}, but OpenSpecUI ${OPENSPECUI_TARGET_MAJOR}.x accepts ${OPENSPEC_CLI_ACCEPTED_RANGE}.`,
  }
}
