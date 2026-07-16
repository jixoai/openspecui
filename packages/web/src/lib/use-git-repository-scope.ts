/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Load the backend-advertised Code and optional Planning repository scopes.
 * 2. Derive the selected scope from URL state with Code as the explicit fallback.
 * 3. Keep selected repository identity shared by Git list and detail routes.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 */
import { parseGitRepositoryScope } from '@/lib/git-panel'
import { trpcClient } from '@/lib/trpc'
import type {
  GitRepositoryScope,
  GitRepositoryScopeDescriptor,
  GitRepositoryScopes,
} from '@openspecui/core'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'

export interface GitRepositoryScopeState {
  requestedScope: GitRepositoryScope
  scope: GitRepositoryScope
  descriptor: GitRepositoryScopeDescriptor | null
  scopes: GitRepositoryScopes | null
  locationSearch: string
  query: UseQueryResult<GitRepositoryScopes, Error>
}

/** Load backend-resolved Code and optional distinct Planning Git repository scopes. */
export function useGitRepositoryScopes(enabled = true): UseQueryResult<GitRepositoryScopes, Error> {
  return useQuery({
    queryKey: ['git', 'scopes'],
    queryFn: () => trpcClient.git.scopes.query(),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export function useGitRepositoryScope(enabled = true): GitRepositoryScopeState {
  const location = useLocation()
  const locationSearch = location.searchStr
  const requestedScope = parseGitRepositoryScope(locationSearch)
  const query = useGitRepositoryScopes(enabled)
  const scopes = query.data ?? null
  const scope: GitRepositoryScope =
    requestedScope === 'planning' && scopes?.planning ? 'planning' : 'code'
  const descriptor = scope === 'planning' ? (scopes?.planning ?? null) : (scopes?.code ?? null)

  return {
    requestedScope,
    scope,
    descriptor,
    scopes,
    locationSearch,
    query,
  }
}
