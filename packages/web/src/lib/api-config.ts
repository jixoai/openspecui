/**
 * API configuration with support for URL parameters
 *
 * Supports:
 * - Same-origin requests (production mode)
 * - URL parameter override: ?api=http://localhost:3100
 */

/**
 * Get API base URL from URL search params or use same-origin
 */
export function getApiBaseUrl(): string {
  const params = new URLSearchParams(window.location.search)
  const apiUrl = params.get('api')

  if (apiUrl) {
    // Remove trailing slash if present
    return apiUrl.replace(/\/$/, '')
  }

  // Default: same-origin (works in production when served from CLI)
  return ''
}

/**
 * Get WebSocket URL based on API base URL
 */
export function getWsUrl(): string {
  const baseUrl = getApiBaseUrl()

  if (baseUrl) {
    // Convert http(s) to ws(s)
    const url = new URL(baseUrl)
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${url.host}/trpc`
  }

  // Same-origin WebSocket
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/trpc`
}

/**
 * Get HTTP URL for tRPC
 */
export function getTrpcUrl(): string {
  const baseUrl = getApiBaseUrl()
  return baseUrl ? `${baseUrl}/trpc` : '/trpc'
}

/**
 * Get health check URL
 */
export function getHealthUrl(): string {
  const baseUrl = getApiBaseUrl()
  return baseUrl ? `${baseUrl}/api/health` : '/api/health'
}
