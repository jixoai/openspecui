/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Prime detail data before forward route View Transitions.
 * 2. Preserve entity identity for Spec, Change, Archive, and Git detail routes.
 * 3. Keep Git prefetch repository binding aligned with the target route URL.
 * 4. Make cold detail preparation opportunistic within the route commit budget.
 *
 * Original request (2026-07-16): "3.7 Git exposes explicit code-repository and planning-repository scopes when they differ"
 * Derived requirement (2026-07-19): Checkpoint 6.11 retires stale Git repository bindings.
 */
import { getGitEntryMetaQueryKey, parseGitRepositoryScope } from '@/lib/git-panel'
import * as StaticProvider from '@/lib/static-data-provider'
import { isStaticMode } from '@/lib/static-mode'
import { queryClient, trpcClient } from '@/lib/trpc'
import { getOpsxStatusSubscriptionCacheKey } from '@/lib/use-opsx'
import {
  getArchiveSubscriptionCacheKey,
  getSpecDocumentSubscriptionCacheKey,
  primeSubscriptionCache,
} from '@/lib/use-subscription'
import type { GitEntrySelector } from '@openspecui/core'
import { specIdentityFromRoute, type SpecIdentity } from '@openspecui/core/spec-catalog'
import { waitForPrepareTask } from './prepare-wait'
import type { VTIntent } from './route-semantics'
import { readGitSharedElementHandoffState, readSharedElementHandoffState } from './shared-elements'

type DetailPrepareMatch =
  | { kind: 'spec'; identity: SpecIdentity }
  | { kind: 'change'; changeId: string }
  | { kind: 'archive'; changeId: string }
  | { kind: 'git'; selector: GitEntrySelector }

type DetailPrepareOutcome = 'ready' | 'cancelled' | 'skip-vt'

const DETAIL_PREPARE_COMMIT_BUDGET_MS = 140
const DETAIL_PREPARE_INDICATOR_DELAY_MS = DETAIL_PREPARE_COMMIT_BUDGET_MS + 1
const QUERY_STALE_TIME_MS = 5 * 60 * 1000

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function matchDetailPreparePath(pathname: string): DetailPrepareMatch | null {
  const ownedSpecMatch = /^\/specs\/owned\/([^/]+)$/.exec(pathname)
  if (ownedSpecMatch) {
    return {
      kind: 'spec',
      identity: specIdentityFromRoute({
        specId: decodePathSegment(ownedSpecMatch[1] ?? ''),
      }),
    }
  }

  const referencedSpecMatch = /^\/specs\/referenced\/([^/]+)\/([^/]+)$/.exec(pathname)
  if (referencedSpecMatch) {
    return {
      kind: 'spec',
      identity: specIdentityFromRoute({
        storeId: decodePathSegment(referencedSpecMatch[1] ?? ''),
        specId: decodePathSegment(referencedSpecMatch[2] ?? ''),
      }),
    }
  }

  const changeMatch = /^\/changes\/([^/]+)$/.exec(pathname)
  if (changeMatch) {
    return { kind: 'change', changeId: decodePathSegment(changeMatch[1] ?? '') }
  }

  const archiveMatch = /^\/archive\/([^/]+)$/.exec(pathname)
  if (archiveMatch) {
    return { kind: 'archive', changeId: decodePathSegment(archiveMatch[1] ?? '') }
  }

  const gitCommitMatch = /^\/git\/commit\/([^/]+)$/.exec(pathname)
  if (gitCommitMatch) {
    return {
      kind: 'git',
      selector: { type: 'commit', hash: decodePathSegment(gitCommitMatch[1] ?? '') },
    }
  }

  if (pathname === '/git/uncommitted') {
    return {
      kind: 'git',
      selector: { type: 'uncommitted' },
    }
  }

  return null
}

async function prepareSpecDetail(identity: SpecIdentity): Promise<void> {
  const document = isStaticMode()
    ? await StaticProvider.getSpecDocument(identity)
    : await trpcClient.spec.document.query(identity)
  primeSubscriptionCache(getSpecDocumentSubscriptionCacheKey(identity), document)
}

async function prepareChangeDetail(changeId: string): Promise<void> {
  const status = isStaticMode()
    ? await StaticProvider.getOpsxStatus(changeId)
    : await trpcClient.opsx.status.query({ change: changeId })
  const cacheKey = getOpsxStatusSubscriptionCacheKey({ change: changeId, refreshKey: 0 })
  if (cacheKey) {
    primeSubscriptionCache(cacheKey, status)
  }
}

async function prepareArchiveDetail(changeId: string): Promise<void> {
  const archive = isStaticMode()
    ? await StaticProvider.getArchive(changeId)
    : await trpcClient.archive.get.query({ id: changeId })
  primeSubscriptionCache(getArchiveSubscriptionCacheKey(changeId), archive)
}

async function prepareGitDetail(
  selector: GitEntrySelector,
  search: string,
  state: unknown
): Promise<void> {
  if (isStaticMode()) {
    return
  }

  const scope = parseGitRepositoryScope(search)
  const descriptor =
    scope === 'planning'
      ? (await trpcClient.git.scopes.query()).planning
      : await trpcClient.git.code.query()
  if (!descriptor) return
  const expectedBindingToken = descriptor.bindingToken
  const rawHandoff = readSharedElementHandoffState(state)
  const handoff = readGitSharedElementHandoffState(state, selector, expectedBindingToken)
  if (rawHandoff?.family === 'git' && !handoff) return
  await queryClient.fetchQuery({
    queryKey: getGitEntryMetaQueryKey(scope, expectedBindingToken, selector),
    queryFn: () => trpcClient.git.getEntryMeta.query({ scope, expectedBindingToken, selector }),
    staleTime: QUERY_STALE_TIME_MS,
  })
}

async function prepareDetailRoute(
  match: DetailPrepareMatch,
  search: string,
  state: unknown
): Promise<void> {
  if (match.kind === 'spec') {
    await prepareSpecDetail(match.identity)
    return
  }

  if (match.kind === 'change') {
    await prepareChangeDetail(match.changeId)
    return
  }

  if (match.kind === 'archive') {
    await prepareArchiveDetail(match.changeId)
    return
  }

  await prepareGitDetail(match.selector, search, state)
}

/** Prefetch one binding-current detail projection before a forward route transition. */
export async function prepareRouteDetailViewTransition(options: {
  intent: VTIntent | null
  pathname: string
  search?: string
  state?: unknown
}): Promise<DetailPrepareOutcome> {
  const { intent, pathname, state } = options
  const search = options.search ?? (typeof window === 'undefined' ? '' : window.location.search)

  if (!intent || intent.kind !== 'route-detail' || intent.direction !== 'forward') {
    return 'ready'
  }

  const match = matchDetailPreparePath(pathname)
  if (!match) {
    return 'ready'
  }

  // Detail preparation is an optimization. A cold request must not hold the route
  // until the full remote timeout; the destination owns its loading projection.
  const reportPrepareError = (error: unknown) => {
    console.error('[VT] Failed to prepare route-detail transition:', error)
  }
  const result = await waitForPrepareTask(() => prepareDetailRoute(match, search, state), {
    deadlineMs: DETAIL_PREPARE_COMMIT_BUDGET_MS,
    indicatorDelayMs: DETAIL_PREPARE_INDICATOR_DELAY_MS,
    onLateError: reportPrepareError,
  })
  if (result.status === 'ready') {
    return 'ready'
  }

  if (result.status === 'cancelled') {
    return 'cancelled'
  }

  if (result.status === 'error') {
    reportPrepareError(result.error)
  }

  return 'skip-vt'
}
