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

export function getHostedApiBootstrapState(
  locationLike: Pick<Location, 'search'>
): HostedApiBootstrapState {
  const sessionId = getSearchParam(locationLike.search, 'session')
  const hosted = sessionId !== null
  const apiBaseUrl = normalizeApiBaseUrl(getSearchParam(locationLike.search, 'api') ?? '')

  return {
    hosted,
    apiBaseUrl,
    sessionId,
  }
}

export function getHostedScopedStorageKey(
  baseKey: string,
  locationLike: Pick<Location, 'search'>
): string {
  const state = getHostedApiBootstrapState(locationLike)
  return state.hosted && state.sessionId ? `hosted-session:${state.sessionId}:${baseKey}` : baseKey
}
