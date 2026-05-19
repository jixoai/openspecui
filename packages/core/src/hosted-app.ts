export const OFFICIAL_APP_BASE_URL = 'https://app.openspecui.com'
export const HOSTED_SHELL_PROTOCOL_VERSION = 1

export const OPENSPECUI_RUNTIME_CAPABILITIES = [
  'notifications.subscribe',
  'config.notifications',
] as const

export type OpenSpecUIRuntimeCapability = (typeof OPENSPECUI_RUNTIME_CAPABILITIES)[number]

export interface HostedBackendHealthResponse {
  status: 'ok'
  projectDir: string
  projectName: string
  watcherEnabled: boolean
  openspecuiVersion: string
  hostedShellProtocolVersion: typeof HOSTED_SHELL_PROTOCOL_VERSION
  embeddedUiUrl: string
  runtimeCapabilities: readonly OpenSpecUIRuntimeCapability[]
}

export interface BackendHealthPayloadInput {
  projectDir: string
  projectName: string
  watcherEnabled: boolean
  openspecuiVersion: string
  embeddedUiUrl: string
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

export function normalizeEmbeddedUiUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Embedded UI URL must not be empty')
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch (error) {
    throw new Error(
      `Invalid embedded UI URL: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  parsed.hash = ''
  const pathname = parsed.pathname.replace(/\/+$/, '')
  parsed.pathname = pathname.length > 0 ? pathname : '/'
  return parsed.toString().replace(/\/$/, parsed.pathname === '/' ? '' : '')
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized.endsWith('.localhost')
  )
}

export function isSupportedEmbeddedUiUrl(input: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return false
  }

  if (parsed.protocol === 'https:') {
    return true
  }

  return parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname)
}

export function buildHostedLaunchUrl(options: { baseUrl: string; apiBaseUrl: string }): string {
  const url = new URL(normalizeHostedAppBaseUrl(options.baseUrl))
  url.searchParams.set('api', options.apiBaseUrl)
  return url.toString()
}

export function buildEmbeddedUiLaunchUrl(options: {
  embeddedUiUrl: string
  apiBaseUrl: string
  sessionId: string
}): string {
  const url = new URL(normalizeEmbeddedUiUrl(options.embeddedUiUrl))
  url.searchParams.set('api', options.apiBaseUrl)
  url.searchParams.set('session', options.sessionId)
  return url.toString()
}

export function buildBackendHealthPayload(
  input: BackendHealthPayloadInput
): HostedBackendHealthResponse {
  return {
    status: 'ok',
    projectDir: input.projectDir,
    projectName: input.projectName,
    watcherEnabled: input.watcherEnabled,
    openspecuiVersion: input.openspecuiVersion,
    hostedShellProtocolVersion: HOSTED_SHELL_PROTOCOL_VERSION,
    embeddedUiUrl: input.embeddedUiUrl,
    runtimeCapabilities: OPENSPECUI_RUNTIME_CAPABILITIES,
  }
}

function hasRequiredRuntimeCapabilities(value: unknown): value is OpenSpecUIRuntimeCapability[] {
  if (!Array.isArray(value)) return false
  const capabilities = new Set(value)
  return OPENSPECUI_RUNTIME_CAPABILITIES.every((capability) => capabilities.has(capability))
}

export function isBackendHealthRuntimeMetadata(
  value: unknown
): value is HostedBackendHealthResponse {
  if (!isRecord(value)) return false
  return (
    value.status === 'ok' &&
    typeof value.projectDir === 'string' &&
    typeof value.projectName === 'string' &&
    typeof value.watcherEnabled === 'boolean' &&
    typeof value.openspecuiVersion === 'string' &&
    value.hostedShellProtocolVersion === HOSTED_SHELL_PROTOCOL_VERSION &&
    typeof value.embeddedUiUrl === 'string' &&
    hasRequiredRuntimeCapabilities(value.runtimeCapabilities)
  )
}

export function isHostedBackendHealthResponse(
  value: unknown
): value is HostedBackendHealthResponse {
  return isBackendHealthRuntimeMetadata(value) && isSupportedEmbeddedUiUrl(value.embeddedUiUrl)
}
