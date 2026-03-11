const HOSTED_VERSION_PATH_RE = /^\/versions\/[^/]+(?:\/|$)/

function getHostedSessionId(locationLike: Pick<Location, 'pathname' | 'search'>): string | null {
  if (!HOSTED_VERSION_PATH_RE.test(locationLike.pathname)) {
    return null
  }
  const value = new URLSearchParams(locationLike.search).get('session')?.trim()
  return value ? value : null
}

export function getSessionScopedStorageKey(
  baseKey: string,
  locationLike: Pick<Location, 'pathname' | 'search'> = window.location
): string {
  const sessionId = getHostedSessionId(locationLike)
  return sessionId ? `hosted-session:${sessionId}:${baseKey}` : baseKey
}
