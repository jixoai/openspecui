import type { DashboardGitEntry, GitEntrySelector, GitWorktreeHandoff } from '@openspecui/core'
import { getHostedApiBootstrapState } from './hosted-session'

export const GIT_ENTRY_PAGE_SIZE = 50

export function toGitEntrySelector(entry: DashboardGitEntry): GitEntrySelector {
  return entry.type === 'commit' ? { type: 'commit', hash: entry.hash } : { type: 'uncommitted' }
}

export function isSameGitEntrySelector(
  left: GitEntrySelector | null,
  right: GitEntrySelector | null
): boolean {
  if (left === right) return true
  if (!left || !right) return false
  if (left.type !== right.type) return false
  if (left.type === 'uncommitted' && right.type === 'uncommitted') return true
  if (left.type === 'commit' && right.type === 'commit') {
    return left.hash === right.hash
  }
  return false
}

export function buildGitEntryHref(selector: GitEntrySelector): string {
  return selector.type === 'commit' ? `/git/commit/${selector.hash}` : '/git/uncommitted'
}

export function buildGitEntryHrefFromEntry(entry: DashboardGitEntry): string {
  return buildGitEntryHref(toGitEntrySelector(entry))
}

export function buildGitWorktreeHandoffHref(options: {
  handoff: GitWorktreeHandoff
  location: Pick<Location, 'href' | 'pathname' | 'search' | 'hash'>
}): string {
  const { handoff, location } = options
  const currentUrl = new URL(location.href)
  const hostedState = getHostedApiBootstrapState({
    pathname: location.pathname,
    search: location.search,
  })

  if (hostedState.hosted) {
    currentUrl.searchParams.set('api', handoff.serverUrl)
    return currentUrl.toString()
  }

  const targetUrl = new URL(handoff.serverUrl)
  targetUrl.pathname = currentUrl.pathname
  targetUrl.search = currentUrl.search
  targetUrl.hash = currentUrl.hash
  return targetUrl.toString()
}
