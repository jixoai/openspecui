const HOSTED_VERSION_PATH_RE = /^\/versions\/[^/]+(?:\/|$)/

export interface HostedApiBootstrapState {
  hosted: boolean
  apiBaseUrl: string | null
  sessionId: string | null
}

function normalizeApiBaseUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  url.hash = ''
  url.search = ''
  const pathname = url.pathname.replace(/\/+$/, '')
  url.pathname = pathname.length > 0 ? pathname : '/'
  return url.toString().replace(/\/$/, url.pathname === '/' ? '' : '')
}

function getSearchParam(search: string, key: string): string | null {
  const value = new URLSearchParams(search).get(key)?.trim()
  return value ? value : null
}

export function isHostedVersionEntryPath(pathname: string): boolean {
  return HOSTED_VERSION_PATH_RE.test(pathname)
}

export function getHostedApiBootstrapState(
  locationLike: Pick<Location, 'pathname' | 'search'>
): HostedApiBootstrapState {
  const hosted = isHostedVersionEntryPath(locationLike.pathname)
  const apiBaseUrl = normalizeApiBaseUrl(getSearchParam(locationLike.search, 'api') ?? '')
  const sessionId = hosted ? getSearchParam(locationLike.search, 'session') : null

  return {
    hosted,
    apiBaseUrl,
    sessionId,
  }
}

export function getHostedScopedStorageKey(
  baseKey: string,
  locationLike: Pick<Location, 'pathname' | 'search'>
): string {
  const state = getHostedApiBootstrapState(locationLike)
  return state.hosted && state.sessionId ? `hosted-session:${state.sessionId}:${baseKey}` : baseKey
}
