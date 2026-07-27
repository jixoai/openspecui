/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Classify protected same-origin data paths for native browser resources.
 * 2. Clone resource requests with one supplied Authorization header and no URL credential.
 *
 * Original request (2026-07-24): "完整审计 Project Web 的 HTTP/tRPC WS/PTY/raw resource 网络路径。"
 */

/** True when a Service Worker request belongs to a protected backend data surface. */
export function isProtectedResourceRequest(request: Request, workerOrigin: string): boolean {
  if (request.method !== 'GET') return false
  const url = new URL(request.url)
  if (url.origin !== workerOrigin) return false
  return (
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/trpc' ||
    url.pathname.startsWith('/trpc/')
  )
}

/** Clone a protected resource request with its page-owned Authorization evidence. */
export function authorizeResourceRequest(request: Request, authorization: string): Request {
  const headers = new Headers(request.headers)
  headers.set('Authorization', authorization)
  return new Request(request, { headers })
}
