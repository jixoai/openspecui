import type { GitWorktreeHandoff } from '@openspecui/core'
import { getHostedApiBootstrapState } from './hosted-session'

export function buildServerHandoffHref(options: {
  handoff: GitWorktreeHandoff
  location: Pick<Location, 'href' | 'pathname' | 'search' | 'hash'>
}): string {
  const { handoff, location } = options
  const currentUrl = new URL(location.href)
  const targetUrl = new URL(handoff.serverUrl)
  const hostedState = getHostedApiBootstrapState({
    search: location.search,
  })

  if (hostedState.hosted) {
    targetUrl.pathname = currentUrl.pathname
    targetUrl.search = currentUrl.search
    targetUrl.hash = currentUrl.hash
    targetUrl.searchParams.set('api', handoff.serverUrl)
    return targetUrl.toString()
  }

  targetUrl.pathname = currentUrl.pathname
  targetUrl.search = currentUrl.search
  targetUrl.hash = currentUrl.hash
  return targetUrl.toString()
}

export function navigateToServerHandoff(options: {
  handoff: GitWorktreeHandoff
  location: Pick<Location, 'href' | 'pathname' | 'search' | 'hash'>
}): void {
  window.location.assign(buildServerHandoffHref(options))
}
