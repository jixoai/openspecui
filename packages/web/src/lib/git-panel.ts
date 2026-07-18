/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Map Git entries to stable selectors and detail routes.
 * 2. Preserve explicit repository scope and binding epoch in query-cache identities.
 * 3. Preserve hosted-session state across worktree handoff URLs.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 * Derived requirement (2026-07-19): Checkpoint 6.11 retires stale Git cache bindings.
 */
import type {
  DashboardGitEntry,
  GitEntrySelector,
  GitRepositoryScope,
  GitWorktreeHandoff,
} from '@openspecui/core'
import { buildServerHandoffHref } from './server-handoff'

export const GIT_ENTRY_PAGE_SIZE = 50
export const GIT_REPOSITORY_SCOPE_SEARCH_PARAM = 'gitScope'

export function parseGitRepositoryScope(search: string): GitRepositoryScope {
  return new URLSearchParams(search).get(GIT_REPOSITORY_SCOPE_SEARCH_PARAM) === 'planning'
    ? 'planning'
    : 'code'
}

/** Map one Git selector to the entity identity carried by handoff state. */
export function getGitEntryEntityId(entry: DashboardGitEntry | GitEntrySelector): string {
  return entry.type === 'commit' ? entry.hash : 'uncommitted'
}

export function buildGitRepositoryHref(
  pathname: string,
  scope: GitRepositoryScope,
  search = ''
): string {
  const params = new URLSearchParams(search)
  if (scope === 'planning') {
    params.set(GIT_REPOSITORY_SCOPE_SEARCH_PARAM, scope)
  } else {
    params.delete(GIT_REPOSITORY_SCOPE_SEARCH_PARAM)
  }
  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}`
}

/** Build binding-isolated metadata cache identity for one Git entry. */
export function getGitEntryMetaQueryKey(
  scope: GitRepositoryScope,
  bindingToken: string,
  selector: GitEntrySelector
): readonly unknown[] {
  return selector.type === 'commit'
    ? ['git', scope, bindingToken, 'meta', 'commit', selector.hash]
    : ['git', scope, bindingToken, 'meta', 'uncommitted']
}

/** Build binding-isolated file-list cache identity for one Git entry. */
export function getGitEntryFilesQueryKey(
  scope: GitRepositoryScope,
  bindingToken: string,
  selector: GitEntrySelector
): readonly unknown[] {
  return selector.type === 'commit'
    ? ['git', scope, bindingToken, 'files', 'commit', selector.hash]
    : ['git', scope, bindingToken, 'files', 'uncommitted']
}

/** Build binding-isolated patch cache identity for one Git file. */
export function getGitEntryPatchQueryKey(
  scope: GitRepositoryScope,
  bindingToken: string,
  selector: GitEntrySelector,
  fileId: string
): readonly unknown[] {
  const selectorKey = selector.type === 'commit' ? `commit:${selector.hash}` : 'uncommitted'
  return ['git', scope, bindingToken, 'patch', selectorKey, fileId]
}

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

export function buildGitEntryHref(
  selector: GitEntrySelector,
  scope: GitRepositoryScope = 'code',
  search = ''
): string {
  const pathname = selector.type === 'commit' ? `/git/commit/${selector.hash}` : '/git/uncommitted'
  return buildGitRepositoryHref(pathname, scope, search)
}

export function buildGitEntryHrefFromEntry(
  entry: DashboardGitEntry,
  scope: GitRepositoryScope = 'code',
  search = ''
): string {
  return buildGitEntryHref(toGitEntrySelector(entry), scope, search)
}

export function buildGitWorktreeHandoffHref(options: {
  handoff: GitWorktreeHandoff
  location: Pick<Location, 'href' | 'pathname' | 'search' | 'hash'>
}): string {
  return buildServerHandoffHref(options)
}
