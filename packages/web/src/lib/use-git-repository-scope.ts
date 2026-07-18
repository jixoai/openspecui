/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Subscribe to backend-advertised Code and optional Planning repository bindings.
 * 2. Derive the selected scope from URL state with Code as the explicit fallback.
 * 3. Join Planning bindings to current scope projection and Root Context readiness.
 * 4. Keep selected repository identity shared by Git list and detail routes.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 * Derived requirement (2026-07-19): Checkpoint 6.11 retires stale Git repository bindings.
 */
import { parseGitRepositoryScope } from '@/lib/git-panel'
import { trpcClient } from '@/lib/trpc'
import { useContextSubscription } from '@/lib/use-context-subscription'
import { useSubscription, type SubscriptionState } from '@/lib/use-subscription'
import type {
  GitRepositoryScope,
  GitRepositoryScopeDescriptor,
  GitRepositoryScopes,
  StaticGitRepositoryScopeDescriptor,
  StaticGitRepositoryScopes,
} from '@openspecui/core'
import { useLocation } from '@tanstack/react-router'

export const STATIC_GIT_SCOPES: StaticGitRepositoryScopes = {
  defaultScope: 'code',
  code: {
    scope: 'code',
    bindingToken: null,
    rootPath: '',
    repository: null,
  },
  planningState: 'settled',
  planning: null,
}

/** Git repository scopes plus the current explicit user selection. */
export interface GitRepositoryScopeState {
  requestedScope: GitRepositoryScope
  scope: GitRepositoryScope
  descriptor: GitRepositoryScopeDescriptor | StaticGitRepositoryScopeDescriptor | null
  scopes: GitRepositoryScopes | StaticGitRepositoryScopes | null
  locationSearch: string
  planningReady: boolean
  planningMessage: string | null
  query: SubscriptionState<GitRepositoryScopes | StaticGitRepositoryScopes>
}

/** Subscribe to backend-resolved Code and optional distinct Planning Git repository bindings. */
export function useGitRepositoryScopes(
  enabled = true
): SubscriptionState<GitRepositoryScopes | StaticGitRepositoryScopes> {
  return useSubscription<GitRepositoryScopes | StaticGitRepositoryScopes>(
    (callbacks) => {
      if (!enabled) return { unsubscribe() {} }
      return trpcClient.git.subscribeScopes.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      })
    },
    async () => STATIC_GIT_SCOPES,
    [enabled],
    'git.subscribeScopes',
    'loading'
  )
}

/** Resolve and retain explicit code/planning Git repository scope selection. */
export function useGitRepositoryScope(enabled = true): GitRepositoryScopeState {
  const location = useLocation()
  const locationSearch = location.searchStr
  const requestedScope = parseGitRepositoryScope(locationSearch)
  const query = useGitRepositoryScopes(enabled)
  const rootContext = useContextSubscription()
  const scopes = query.data ?? null
  const planning = scopes?.planning ?? null
  const rootProjection = rootContext.data
  const currentPlanningPath =
    rootProjection?.state === 'ready' ? rootProjection.data.planningRoot?.path : null
  const planningReady =
    planning !== null &&
    scopes?.planningState === 'settled' &&
    !query.isLoading &&
    query.error === null &&
    !rootContext.isLoading &&
    rootContext.error === null &&
    currentPlanningPath === planning.rootPath
  const scope: GitRepositoryScope =
    requestedScope === 'planning' && planningReady ? 'planning' : 'code'
  const descriptor = scope === 'planning' ? planning : (scopes?.code ?? null)
  const planningMessage =
    requestedScope !== 'planning' || planningReady
      ? null
      : query.error
        ? `Git repository scope projection failed: ${query.error.message}`
        : query.isLoading
          ? 'Git repository scope projection is loading.'
          : rootContext.error
            ? `Planning Root Context failed: ${rootContext.error.message}`
            : rootProjection?.state === 'error'
              ? `Planning Root Context failed: ${rootProjection.error.message}`
              : rootProjection?.state === 'refreshing' || rootProjection?.state === 'loading'
                ? 'Planning repository is locked while Root Context refreshes.'
                : scopes?.planningState === 'resolving'
                  ? 'Planning repository binding is resolving.'
                  : scopes?.planningState === 'failed'
                    ? `Planning Git repository binding failed: ${scopes.planningError.message}`
                    : planning === null
                      ? 'Planning root is not a distinct Git repository; using Code repository.'
                      : 'Planning repository binding is waiting for the current Root Context.'

  return {
    requestedScope,
    scope,
    descriptor,
    scopes,
    locationSearch,
    planningReady,
    planningMessage,
    query,
  }
}
