import type {
  HostedAppChannelManifest,
  HostedAppVersionManifest,
} from '@openspecui/core/hosted-app'

export function resolveChannelIdFromPathname(pathname: string): string | null {
  const match = /^\/versions\/([^/]+)(?:\/|$)/.exec(pathname)
  return match?.[1] ?? null
}

function isVersionRouteShellPath(channel: HostedAppChannelManifest, pathname: string): boolean {
  if (pathname === channel.rootPath || pathname === channel.shellPath) {
    return true
  }

  if (!pathname.startsWith(channel.rootPath)) {
    return false
  }

  const relative = pathname.slice(channel.rootPath.length)
  if (relative.length === 0 || relative === 'index.html') {
    return true
  }

  const lastSegment = relative.split('/').pop() ?? ''
  return !lastSegment.includes('.')
}

export function resolveVersionedNavigationShell(
  manifest: HostedAppVersionManifest,
  requestUrl: URL
): HostedAppChannelManifest | null {
  const channelId = resolveChannelIdFromPathname(requestUrl.pathname)
  if (!channelId) return null

  const channel = manifest.channels[channelId]
  if (!channel) return null
  return isVersionRouteShellPath(channel, requestUrl.pathname) ? channel : null
}

export function buildVersionedNavigationShellUrl(
  channel: HostedAppChannelManifest,
  requestUrl: URL
): URL {
  return new URL(channel.shellPath, requestUrl.origin)
}

function isHtmlDocumentContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false
  }

  return /(?:text\/html|application\/xhtml\+xml)/i.test(contentType)
}

export function buildVersionedNavigationShellMarker(channelId: string): string {
  return `window.__OPENSPEC_BASE_PATH__ = '/versions/${channelId}/'`
}

export function hasVersionedNavigationShellMarker(channelId: string, content: string): boolean {
  return content.includes(buildVersionedNavigationShellMarker(channelId))
}

export function isVersionedNavigationShellResponse(
  channel: HostedAppChannelManifest,
  requestUrl: URL,
  responseUrl: string,
  contentType: string | null
): boolean {
  if (!isHtmlDocumentContentType(contentType)) {
    return false
  }

  try {
    const resolved = new URL(responseUrl, requestUrl.origin)
    return resolved.origin === requestUrl.origin && resolved.pathname.startsWith(channel.rootPath)
  } catch {
    return false
  }
}

export function hasHostedLaunchNavigationParams(requestUrl: URL): boolean {
  return requestUrl.searchParams.has('api') || requestUrl.searchParams.has('session')
}

export function renderServiceWorkerError(message: string, status = 404): Response {
  return new Response(
    `<!doctype html><html><body><main><h1>OpenSpec UI App</h1><p>${message}</p></main></body></html>`,
    {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }
  )
}
