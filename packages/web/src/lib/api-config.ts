import { getHostedApiBootstrapState } from './hosted-session'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined'
}

export function getHostedApiState(): ReturnType<typeof getHostedApiBootstrapState> {
  if (!isBrowser()) {
    return {
      hosted: false,
      apiBaseUrl: null,
      sessionId: null,
    }
  }

  return getHostedApiBootstrapState(window.location)
}

export function getApiBaseUrl(): string {
  if (!isBrowser()) {
    return ''
  }

  return getHostedApiState().apiBaseUrl ?? ''
}

function buildWebSocketUrl(pathname: string): string {
  if (!isBrowser()) {
    return ''
  }

  const baseUrl = getApiBaseUrl()
  if (baseUrl) {
    const url = new URL(baseUrl)
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${url.host}${pathname}`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${pathname}`
}

export function getWsUrl(): string {
  return buildWebSocketUrl('/trpc')
}

export function getPtyWsUrl(): string {
  return buildWebSocketUrl('/ws/pty')
}

export function getTrpcUrl(): string {
  const baseUrl = getApiBaseUrl()
  return baseUrl ? `${baseUrl}/trpc` : '/trpc'
}

export function getHealthUrl(): string {
  const baseUrl = getApiBaseUrl()
  return baseUrl ? `${baseUrl}/api/health` : '/api/health'
}
