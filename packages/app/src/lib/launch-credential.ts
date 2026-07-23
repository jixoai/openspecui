/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Bind a consumed launch credential to exactly one normalized backend API locator.
 * 2. Keep credentials in process memory and out of URLs, persisted tabs, storage, and logs.
 * 3. Return credential-free stripping/configuration evidence to launch owners.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
 * Delivery correction (2026-07-24): replace the global session credential with a per-locator registry.
 */
import { normalizeHostedApiBaseUrl } from './shell-state'

const CREDENTIAL_FRAGMENT_PARAM = 'credential'
const credentialsByApiLocator = new Map<string, string>()

export type LaunchCredentialConsumeResult =
  | { status: 'absent'; sanitizedHash: string }
  | { status: 'bound'; apiBaseUrl: string; sanitizedHash: string }
  | { status: 'configuration-error'; error: string; sanitizedHash: string }

function sanitizeCredentialHash(params: URLSearchParams): string {
  params.delete(CREDENTIAL_FRAGMENT_PARAM)
  const remaining = params.toString()
  return remaining ? `#${remaining}` : ''
}

/** Bind one credential to its normalized locator without exposing it in the returned launch evidence. */
export function bindLaunchCredential(apiBaseUrl: string, credential: string): boolean {
  const normalizedApiBaseUrl = normalizeHostedApiBaseUrl(apiBaseUrl)
  if (!normalizedApiBaseUrl || credential.length === 0) return false
  credentialsByApiLocator.set(normalizedApiBaseUrl, credential)
  return true
}

/**
 * Consume a fragment credential and bind it to the supplied launch locator. The caller owns applying
 * `sanitizedHash` to a visible URL; the result deliberately never carries the credential value.
 */
export function consumeLaunchCredential(options: {
  apiBaseUrl: string | null | undefined
  hash: string
}): LaunchCredentialConsumeResult {
  if (!options.hash.startsWith('#')) {
    return { status: 'absent', sanitizedHash: options.hash }
  }

  const params = new URLSearchParams(options.hash.slice(1))
  const credential = params.get(CREDENTIAL_FRAGMENT_PARAM)
  if (credential === null) {
    return { status: 'absent', sanitizedHash: options.hash }
  }

  const sanitizedHash = sanitizeCredentialHash(params)
  const normalizedApiBaseUrl = options.apiBaseUrl
    ? normalizeHostedApiBaseUrl(options.apiBaseUrl)
    : null
  if (!normalizedApiBaseUrl || credential.length === 0) {
    return {
      status: 'configuration-error',
      error:
        'The launch credential requires a valid ?api=<backend URL> locator. Relaunch from the backend or remove the credential fragment.',
      sanitizedHash,
    }
  }

  credentialsByApiLocator.set(normalizedApiBaseUrl, credential)
  return { status: 'bound', apiBaseUrl: normalizedApiBaseUrl, sanitizedHash }
}

/** Read the runtime-only credential associated with one normalized backend locator. */
export function readLaunchCredential(apiBaseUrl: string): string | null {
  const normalizedApiBaseUrl = normalizeHostedApiBaseUrl(apiBaseUrl)
  return normalizedApiBaseUrl ? (credentialsByApiLocator.get(normalizedApiBaseUrl) ?? null) : null
}

/** Clear only the credential associated with the supplied backend locator. */
export function clearLaunchCredential(apiBaseUrl: string): void {
  const normalizedApiBaseUrl = normalizeHostedApiBaseUrl(apiBaseUrl)
  if (normalizedApiBaseUrl) credentialsByApiLocator.delete(normalizedApiBaseUrl)
}
