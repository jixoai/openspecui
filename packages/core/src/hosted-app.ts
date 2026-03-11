export const OFFICIAL_APP_BASE_URL = 'https://app.openspecui.com'

export type HostedAppChannelKind = 'latest' | 'major' | 'minor'

export interface HostedAppChannelManifest {
  id: string
  kind: HostedAppChannelKind
  selector: string
  resolvedVersion: string
  rootPath: string
  shellPath: string
  major: number
  minor?: number
}

export interface HostedAppCompatibilityEntry {
  range: string
  channel: string
}

export interface HostedAppVersionManifest {
  packageName: 'openspecui'
  generatedAt: string
  defaultChannel: string
  channels: Record<string, HostedAppChannelManifest>
  compatibility: HostedAppCompatibilityEntry[]
}

export interface HostedBackendHealthResponse {
  status: 'ok'
  projectDir: string
  projectName: string
  watcherEnabled: boolean
  openspecuiVersion: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function withHttpsProtocol(value: string): string {
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value)) {
    return value
  }
  return `https://${value}`
}

function parseVersionTuple(raw: string): { major: number; minor: number; patch: number } | null {
  const match = raw.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  if (!match) return null

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function parseCompatibilityRange(range: string): { major: number; minor: number } | null {
  const match = range.trim().match(/^~(\d+)\.(\d+)\.\d+$/)
  if (!match) return null

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
  }
}

export function normalizeHostedAppBaseUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Hosted app base URL must not be empty')
  }

  let parsed: URL
  try {
    parsed = new URL(withHttpsProtocol(trimmed))
  } catch (error) {
    throw new Error(
      `Invalid hosted app base URL: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  parsed.hash = ''
  parsed.search = ''
  const pathname = parsed.pathname.replace(/\/+$/, '')
  parsed.pathname = pathname.length > 0 ? pathname : '/'
  return parsed.toString().replace(/\/$/, parsed.pathname === '/' ? '' : '')
}

export function resolveHostedAppBaseUrl(options: {
  override?: string | null
  configured?: string | null
}): string {
  const candidate = options.override?.trim() || options.configured?.trim() || OFFICIAL_APP_BASE_URL
  return normalizeHostedAppBaseUrl(candidate)
}

export function buildHostedVersionManifestUrl(baseUrl: string): string {
  return `${normalizeHostedAppBaseUrl(baseUrl)}/version.json`
}

export function buildHostedLaunchUrl(options: { baseUrl: string; apiBaseUrl: string }): string {
  const url = new URL(normalizeHostedAppBaseUrl(options.baseUrl))
  url.searchParams.set('api', options.apiBaseUrl)
  return url.toString()
}

export function isHostedAppVersionManifest(value: unknown): value is HostedAppVersionManifest {
  if (!isRecord(value)) return false
  if (value.packageName !== 'openspecui') return false
  if (typeof value.generatedAt !== 'string') return false
  if (typeof value.defaultChannel !== 'string') return false
  if (!isRecord(value.channels)) return false
  if (!Array.isArray(value.compatibility)) return false

  return Object.values(value.channels).every((channel) => {
    if (!isRecord(channel)) return false
    return (
      typeof channel.id === 'string' &&
      typeof channel.kind === 'string' &&
      typeof channel.selector === 'string' &&
      typeof channel.resolvedVersion === 'string' &&
      typeof channel.rootPath === 'string' &&
      typeof channel.shellPath === 'string' &&
      typeof channel.major === 'number'
    )
  })
}

export function isHostedBackendHealthResponse(
  value: unknown
): value is HostedBackendHealthResponse {
  if (!isRecord(value)) return false
  return (
    value.status === 'ok' &&
    typeof value.projectDir === 'string' &&
    typeof value.projectName === 'string' &&
    typeof value.watcherEnabled === 'boolean' &&
    typeof value.openspecuiVersion === 'string'
  )
}

export function resolveHostedChannelForVersion(
  manifest: HostedAppVersionManifest,
  version: string
): string | null {
  const parsed = parseVersionTuple(version)
  if (!parsed) return null

  for (const entry of manifest.compatibility) {
    const range = parseCompatibilityRange(entry.range)
    if (!range) continue
    if (!manifest.channels[entry.channel]) continue
    if (range.major === parsed.major && range.minor === parsed.minor) {
      return entry.channel
    }
  }

  const exactMinorChannel = `v${parsed.major}.${parsed.minor}`
  if (manifest.channels[exactMinorChannel]) return exactMinorChannel

  const majorChannel = `v${parsed.major}`
  if (manifest.channels[majorChannel]) return majorChannel

  return manifest.channels[manifest.defaultChannel] ? manifest.defaultChannel : null
}
