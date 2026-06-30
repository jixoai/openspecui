export const OPENSPECUI_TARGET_MAJOR = 5
export const OPENSPEC_CLI_TARGET_SERIES = '1.5'
export const OPENSPEC_CLI_LEGACY_SERIES = '1.4'
export const OPENSPEC_CLI_MIN_VERSION = '1.4.0'
export const OPENSPEC_CLI_TARGET_MIN_VERSION = '1.5.0'
export const OPENSPEC_CLI_RECOMMENDED_MIN_VERSION = '1.5.0'
export const OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION = '1.6.0'
export const OPENSPEC_CLI_ACCEPTED_RANGE = '>=1.4.0 <1.6.0'
export const OPENSPEC_CLI_RECOMMENDED_RANGE = '>=1.5.0 <1.6.0'
export const OPENSPEC_CLI_LEGACY_RANGE = '>=1.4.0 <1.5.0'
export const OPENSPEC_CLI_REFERENCE_TAG_PATTERN = 'v1.5.*'

export interface OpenSpecCliVersion {
  major: number
  minor: number
  patch: number
}

export type OpenSpecCliCompatibilityStatus =
  | 'current'
  | 'legacy-compatible'
  | 'unsupported'
  | 'unknown'

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
 * A version is "current/recommended" when it falls inside the recommended
 * range (e.g. `>=1.5.0 <1.6.0`). OpenSpecUI follows a 1:1 major-to-minor
 * version law: one OpenSpecUI major line targets exactly one OpenSpec CLI
 * minor line (2.x→1.2, 3.x→1.3, 4.x→1.4, 5.x→1.5). The previous minor line
 * is accepted as legacy-compatible; older lines are unsupported.
 */
function isCurrentRecommended(version: OpenSpecCliVersion): boolean {
  const min = parseOpenSpecCliVersion(OPENSPEC_CLI_RECOMMENDED_MIN_VERSION)
  const max = parseOpenSpecCliVersion(OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION)
  if (!min || !max) return isSeries(version, OPENSPEC_CLI_TARGET_SERIES)
  const atOrAboveMin = compareOpenSpecCliVersions(version, min) >= 0
  const belowMax = compareOpenSpecCliVersions(version, max) < 0
  return atOrAboveMin && belowMax
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

  if (isSeries(version, OPENSPEC_CLI_LEGACY_SERIES)) {
    return {
      rawVersion,
      version,
      status: 'legacy-compatible',
      supported: true,
      recommended: false,
      blocksCoreInteractions: false,
      message: `OpenSpec CLI ${formatOpenSpecCliVersion(version)} is legacy-compatible with OpenSpecUI ${OPENSPECUI_TARGET_MAJOR}.x. Upgrade to ${OPENSPEC_CLI_RECOMMENDED_RANGE} for the current line.`,
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
