/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Define browser-safe hosted backend metadata and compatibility capability facts.
 * 2. Normalize App/embedded launch locators and carry session-only credentials in fragments.
 * 3. Validate embedded UI origins without inventing backend authority.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Delivery correction (2026-07-24): privately carry the exact Access Gate credential to Project Web.
 */
export const OFFICIAL_APP_BASE_URL = 'https://app.openspecui.com'
export const HOSTED_SHELL_PROTOCOL_VERSION = 1
export const ACCESS_GATE_CREDENTIAL_FRAGMENT_PARAM = 'credential'

export const OPENSPECUI_RUNTIME_CAPABILITIES = [
  'notifications.subscribe',
  'config.notifications',
] as const

export type OpenSpecUIRuntimeCapability = (typeof OPENSPECUI_RUNTIME_CAPABILITIES)[number]

/** Hosted-protocol capability vocabulary emitted by the backend (compatibility facts only). */
export const HOSTED_STORE_CAPABILITIES = [
  'stores.inspect',
  'stores.mutate',
  'contexts.inspect',
] as const

/** Brief Root Context summary carried by the hosted health response. */
export interface HostedBackendRootSummary {
  /** Display-safe planning-root path; absolute paths are not exposed over the protocol. */
  planningRootPath: string | null
  /** How the CLI resolved the planning root. */
  rootSource: 'nearest' | 'declared' | 'store' | 'implicit'
  /** Effective Store id when the root was selected through an explicit Store. */
  storeId: string | null
  /** Whether the planning root is currently writable and ready. */
  ready: boolean
}

export interface HostedBackendHealthResponse {
  status: 'ok'
  projectDir: string
  projectName: string
  watcherEnabled: boolean
  openspecuiVersion: string
  hostedShellProtocolVersion: typeof HOSTED_SHELL_PROTOCOL_VERSION
  embeddedUiUrl: string
  runtimeCapabilities: readonly OpenSpecUIRuntimeCapability[]
  /**
   * Protocol-version-gated additions (OpenSpec 1.6 hosted protocol). All fields are additive so the
   * legacy validator tolerates their absence on older backends.
   */
  apiBaseUrl?: string
  cliVersion?: string | null
  /** Backend-issued opaque runtime-environment identity (host identity + effective data home). */
  envUri?: string
  rootSummary?: HostedBackendRootSummary | null
  /** Product-level Store/Context capability vocabulary (compatibility, not permissions). */
  hostedCapabilities?: readonly (typeof HOSTED_STORE_CAPABILITIES)[number][]
  /** True when the whole-backend Access Gate is enabled. */
  accessGateEnabled?: boolean
}

export interface BackendHealthPayloadInput {
  projectDir: string
  projectName: string
  watcherEnabled: boolean
  openspecuiVersion: string
  embeddedUiUrl: string
  /** Optional 1.6 hosted-protocol additions. */
  apiBaseUrl?: string
  cliVersion?: string | null
  envUri?: string
  rootSummary?: HostedBackendRootSummary | null
  accessGateEnabled?: boolean
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

function setAccessGateCredentialFragment(url: URL, credential?: string | null): void {
  if (!credential) return
  const fragment = new URLSearchParams(url.hash.slice(1))
  fragment.set(ACCESS_GATE_CREDENTIAL_FRAGMENT_PARAM, credential)
  url.hash = fragment.toString()
}

export function buildHostedLaunchUrl(options: {
  baseUrl: string
  apiBaseUrl: string
  credential?: string | null
}): string {
  const url = new URL(normalizeHostedAppBaseUrl(options.baseUrl))
  url.searchParams.set('api', options.apiBaseUrl)
  setAccessGateCredentialFragment(url, options.credential)
  return url.toString()
}

export function buildEmbeddedUiLaunchUrl(options: {
  embeddedUiUrl: string
  apiBaseUrl: string
  sessionId: string
  credential?: string | null
}): string {
  const url = new URL(normalizeEmbeddedUiUrl(options.embeddedUiUrl))
  url.searchParams.set('api', options.apiBaseUrl)
  url.searchParams.set('session', options.sessionId)
  setAccessGateCredentialFragment(url, options.credential)
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
    // 1.6 hosted-protocol additions. All additive so the legacy validator tolerates older backends.
    apiBaseUrl: input.apiBaseUrl,
    cliVersion: input.cliVersion,
    envUri: input.envUri,
    rootSummary: input.rootSummary,
    hostedCapabilities: [...HOSTED_STORE_CAPABILITIES],
    accessGateEnabled: input.accessGateEnabled,
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
