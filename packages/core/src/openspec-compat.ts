/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Encode the shipped OpenSpecUI release line's OpenSpec CLI compatibility law.
 * 2. Classify current, supported non-current, unsupported, and unknown CLI versions.
 * 3. Express the accepted range and the recommended line as separate public facts.
 * 4. Derive per-command capabilities from the detected admitted CLI version.
 * 5. Re-export the browser-safe contract schemas for renderer evidence boundaries.
 *
 * Original request (2026-07-15): "CLI 1.6 兼容性门禁。"
 * Original request (2026-07-31): "目前这个版本先给它支持1.7.*，因为基本兼容。"
 * Owner clarification (2026-07-31): "6.* 本身就是适配 1.6.*；对于 1.7 只是兼容而已。"
 * Original request (2026-08-01): "v7不兼容1.6.x，明确要求必须使用 v1.7.x。"
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
export const OPENSPECUI_TARGET_MAJOR = 9
// Browser-safe contract schemas this surface re-exports for renderer evidence boundaries.
// Both modules import only zod, so this subpath stays free of Node-only module graphs
// (the Core barrel re-exports Node-bound values like reactive-fs and must not be imported
// as a value from browser code).
export { CliCommandTransportSchema } from './cli-contracts/command-result.js'
export { CliValidateReportSchema } from './cli-contracts/workflow.js'

export const OPENSPEC_CLI_TARGET_SERIES = '1.9'
export const OPENSPEC_CLI_SUPPORTED_SERIES = ['1.8', '1.9'] as const
export const OPENSPEC_CLI_MIN_VERSION = '1.8.0'
export const OPENSPEC_CLI_TARGET_MIN_VERSION = '1.9.0'
export const OPENSPEC_CLI_RECOMMENDED_MIN_VERSION = '1.9.0'
export const OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION = '1.10.0'
export const OPENSPEC_CLI_ACCEPTED_RANGE = '>=1.8.0 <1.10.0'
export const OPENSPEC_CLI_RECOMMENDED_RANGE = '>=1.9.0 <1.10.0'
export const OPENSPEC_CLI_REFERENCE_TAG_PATTERN = 'v1.9.*'

/** Per-command capabilities derived from one admitted OpenSpec CLI version. */
export interface OpenSpecCliCapabilities {
  /** `openspec schemas --json --store <id>` exists (OpenSpec 1.9+; 1.8 rejects the selector). */
  schemasRootSelector: boolean
  /** `openspec validate --archived --json` exists (OpenSpec 1.9+; 1.8 rejects the option). */
  archivedValidation: boolean
}

/**
 * Derive command capabilities from one parsed CLI version.
 *
 * Only an admitted version — stable inside the accepted range — can select version-specific
 * capabilities. Unsupported forms (prereleases, >=1.10, below-range) and unparseable output
 * keep their mismatch evidence and expose no capability, so a page-level version bypass can
 * never manufacture a 1.9 command surface for a CLI the release line does not admit.
 */
export function deriveOpenSpecCliCapabilities(
  version: OpenSpecCliVersion | null
): OpenSpecCliCapabilities {
  if (!isAdmittedVersion(version)) {
    return { schemasRootSelector: false, archivedValidation: false }
  }
  const onTargetSeries = isSeries(version, OPENSPEC_CLI_TARGET_SERIES)
  return {
    schemasRootSelector: onTargetSeries,
    archivedValidation: onTargetSeries,
  }
}

export interface OpenSpecCliVersion {
  major: number
  minor: number
  patch: number
  prerelease: string | null
}

/**
 * Compatibility classification for one detected CLI version.
 *
 * - `current`: stable version on the recommended target series.
 * - `supported`: stable version inside the accepted range but not on the target series.
 * - `unsupported`: stable version outside the accepted range, or any prerelease.
 * - `unknown`: the version output could not be parsed.
 */
export type OpenSpecCliCompatibilityStatus = 'current' | 'supported' | 'unsupported' | 'unknown'

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

function isStable(version: OpenSpecCliVersion): boolean {
  return version.prerelease === null
}

/** True only for stable versions inside the accepted range (current or supported non-current). */
function isAdmittedVersion(version: OpenSpecCliVersion | null): version is OpenSpecCliVersion {
  if (!version || !isStable(version)) return false
  return isSeries(version, OPENSPEC_CLI_TARGET_SERIES) || isSupportedNonCurrentSeries(version)
}

function isSupportedNonCurrentSeries(version: OpenSpecCliVersion): boolean {
  const nonCurrentSeries = OPENSPEC_CLI_SUPPORTED_SERIES.filter(
    (series) => series !== OPENSPEC_CLI_TARGET_SERIES
  )
  return nonCurrentSeries.some((series) => isSeries(version, series))
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
      message: `Unable to parse OpenSpec CLI version. Accepted: ${OPENSPEC_CLI_ACCEPTED_RANGE} (recommended ${OPENSPEC_CLI_RECOMMENDED_RANGE}).`,
    }
  }

  if (isStable(version) && isSeries(version, OPENSPEC_CLI_TARGET_SERIES)) {
    return {
      rawVersion,
      version,
      status: 'current',
      supported: true,
      recommended: true,
      blocksCoreInteractions: false,
      message: `OpenSpec CLI ${formatOpenSpecCliVersion(version)} matches the OpenSpecUI ${OPENSPECUI_TARGET_MAJOR}.x recommended ${OPENSPEC_CLI_TARGET_SERIES} line.`,
    }
  }

  if (isStable(version) && isSupportedNonCurrentSeries(version)) {
    return {
      rawVersion,
      version,
      status: 'supported',
      supported: true,
      recommended: false,
      blocksCoreInteractions: false,
      message: `OpenSpec CLI ${formatOpenSpecCliVersion(version)} is supported by OpenSpecUI ${OPENSPECUI_TARGET_MAJOR}.x (${OPENSPEC_CLI_ACCEPTED_RANGE}); the recommended line is ${OPENSPEC_CLI_RECOMMENDED_RANGE}.`,
    }
  }

  return {
    rawVersion,
    version,
    status: 'unsupported',
    supported: false,
    recommended: false,
    blocksCoreInteractions: true,
    message: `Detected OpenSpec CLI ${formatOpenSpecCliVersion(version)}, but OpenSpecUI ${OPENSPECUI_TARGET_MAJOR}.x accepts ${OPENSPEC_CLI_ACCEPTED_RANGE} and recommends ${OPENSPEC_CLI_RECOMMENDED_RANGE}; prereleases are not supported.`,
  }
}
