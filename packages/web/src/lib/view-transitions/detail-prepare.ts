import * as StaticProvider from '@/lib/static-data-provider'
import { isStaticMode } from '@/lib/static-mode'
import { queryClient, trpcClient } from '@/lib/trpc'
import { getOpsxStatusSubscriptionCacheKey } from '@/lib/use-opsx'
import {
  getArchiveSubscriptionCacheKey,
  getSpecSubscriptionCacheKey,
  primeSubscriptionCache,
} from '@/lib/use-subscription'
import type { GitEntrySelector } from '@openspecui/core'
import { waitForPrepareTask } from './prepare-wait'
import type { VTIntent } from './route-semantics'

type DetailPrepareMatch =
  | { kind: 'spec'; specId: string }
  | { kind: 'change'; changeId: string }
  | { kind: 'archive'; changeId: string }
  | { kind: 'git'; selector: GitEntrySelector }

type DetailPrepareOutcome = 'ready' | 'cancelled' | 'skip-vt'

const QUERY_STALE_TIME_MS = 5 * 60 * 1000

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function matchDetailPreparePath(pathname: string): DetailPrepareMatch | null {
  const specMatch = /^\/specs\/([^/]+)$/.exec(pathname)
  if (specMatch) {
    return { kind: 'spec', specId: decodePathSegment(specMatch[1] ?? '') }
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

async function prepareSpecDetail(specId: string): Promise<void> {
  const spec = isStaticMode()
    ? await StaticProvider.getSpec(specId)
    : await trpcClient.spec.get.query({ id: specId })
  primeSubscriptionCache(getSpecSubscriptionCacheKey(specId), spec)
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

function getGitShellQueryKey(selector: GitEntrySelector): readonly unknown[] {
  return selector.type === 'commit'
    ? ['git', 'shell', 'commit', selector.hash]
    : ['git', 'shell', 'uncommitted']
}

async function prepareGitDetail(selector: GitEntrySelector): Promise<void> {
  if (isStaticMode()) {
    return
  }

  await queryClient.fetchQuery({
    queryKey: getGitShellQueryKey(selector),
    queryFn: () => trpcClient.git.getEntryShell.query({ selector }),
    staleTime: QUERY_STALE_TIME_MS,
  })
}

async function prepareDetailRoute(match: DetailPrepareMatch): Promise<void> {
  if (match.kind === 'spec') {
    await prepareSpecDetail(match.specId)
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

  await prepareGitDetail(match.selector)
}

export async function prepareRouteDetailViewTransition(options: {
  intent: VTIntent | null
  pathname: string
}): Promise<DetailPrepareOutcome> {
  const { intent, pathname } = options

  if (!intent || intent.kind !== 'route-detail' || intent.direction !== 'forward') {
    return 'ready'
  }

  const match = matchDetailPreparePath(pathname)
  if (!match) {
    return 'ready'
  }

  const result = await waitForPrepareTask(() => prepareDetailRoute(match))
  if (result.status === 'ready') {
    return 'ready'
  }

  if (result.status === 'cancelled') {
    return 'cancelled'
  }

  if (result.status === 'error') {
    console.error('[VT] Failed to prepare route-detail transition:', result.error)
  }

  return 'skip-vt'
}
