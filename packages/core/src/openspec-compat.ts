/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Encode the shipped OpenSpecUI release line's OpenSpec CLI compatibility law.
 * 2. Classify adapted, compatible, unsupported, and unknown CLI versions.
 *
 * Original request (2026-07-15): "CLI 1.6 兼容性门禁。"
 * Original request (2026-07-31): "目前这个版本先给它支持1.7.*，因为基本兼容。"
 * Owner clarification (2026-07-31): "6.* 本身就是适配 1.6.*；对于 1.7 只是兼容而已。"
 */
export const OPENSPECUI_TARGET_MAJOR = 6
export const OPENSPEC_CLI_TARGET_SERIES = '1.6'
export const OPENSPEC_CLI_COMPATIBLE_SERIES = '1.7'
export const OPENSPEC_CLI_MIN_VERSION = '1.6.0'
export const OPENSPEC_CLI_TARGET_MIN_VERSION = '1.6.0'
export const OPENSPEC_CLI_RECOMMENDED_MIN_VERSION = '1.6.0'
export const OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION = '1.8.0'
export const OPENSPEC_CLI_ACCEPTED_RANGE = '>=1.6.0 <1.8.0'
export const OPENSPEC_CLI_RECOMMENDED_RANGE = '>=1.6.0 <1.7.0'
export const OPENSPEC_CLI_COMPATIBLE_RANGE = '>=1.7.0 <1.8.0'
export const OPENSPEC_CLI_REFERENCE_TAG_PATTERN = 'v1.6.*'

export interface OpenSpecCliVersion {
  major: number
  minor: number
  patch: number
}

export type OpenSpecCliCompatibilityStatus = 'current' | 'compatible' | 'unsupported' | 'unknown'

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
  const match = raw.match(/(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

export function formatOpenSpecCliVersion(version: OpenSpecCliVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`
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

/**
 * A version is "current/recommended" only when it belongs to the adapted
 * target minor series (OpenSpec CLI 1.6 for OpenSpecUI 6.1). OpenSpecUI
 * ordinarily advances its target CLI line with a product major; this release
 * accepts the basically compatible 1.7 line without changing its target.
 */
function isCurrentRecommended(version: OpenSpecCliVersion): boolean {
  return isSeries(version, OPENSPEC_CLI_TARGET_SERIES)
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

  if (isSeries(version, OPENSPEC_CLI_COMPATIBLE_SERIES)) {
    return {
      rawVersion,
      version,
      status: 'compatible',
      supported: true,
      recommended: false,
      blocksCoreInteractions: false,
      message: `OpenSpec CLI ${formatOpenSpecCliVersion(version)} is compatible with OpenSpecUI ${OPENSPECUI_TARGET_MAJOR}.x. The ${OPENSPECUI_TARGET_MAJOR}.x line remains adapted to ${OPENSPEC_CLI_RECOMMENDED_RANGE}.`,
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
