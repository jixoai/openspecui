/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Keep raw CLI Root Context resolution available to the serialized Planning-root owner.
 * 2. Drive subscription loading, refreshing, ready, and stale-error transitions through that owner.
 * 3. Register current project/root/data-scope dependencies with the reactive filesystem.
 *
 * Original request (2026-07-15): "操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
 */
import {
  ReactiveContext,
  reactiveReadFile,
  reactiveStat,
  resolveRootContext,
  type RootContext,
  type RootContextCli,
  type RootContextResolvedState,
  type RootContextState,
} from '@openspecui/core'
import { observable } from '@trpc/server/observable'
import { join, resolve } from 'node:path'

/** Server-side dependencies for one Root Context resolution attempt. */
export interface RootContextServerSource {
  projectDir: string
  cliExecutor: RootContextCli
  now?: () => number
}

interface RootContextDependencySource {
  projectDir: string
}

/** Serialized owner that transitions Planning-root resources before exposing Root Context truth. */
export interface RootContextSubscriptionSource {
  /** Resolve current truth only after its Planning-root resource transition settles. */
  resolveRootContextReactive(): Promise<RootContextResolvedState>
  now?: () => number
}

function currentTime(source: { now?: () => number }): number {
  return source.now?.() ?? Date.now()
}

function currentAttempt(state: RootContextResolvedState): RootContext {
  return state.state === 'ready' ? state.data : state.attempt
}

const ROOT_HEALTH_PATHS = [
  'openspec',
  'openspec/specs',
  'openspec/changes',
  'openspec/changes/archive',
] as const

async function trackOpenSpecRootHealth(rootPath: string): Promise<void> {
  await Promise.all([
    reactiveStat(rootPath),
    ...ROOT_HEALTH_PATHS.map((relativePath) => reactiveStat(join(rootPath, relativePath))),
    reactiveReadFile(join(rootPath, 'openspec', 'config.yaml')),
    reactiveReadFile(join(rootPath, 'openspec', 'config.yml')),
    reactiveReadFile(join(rootPath, '.openspec-store', 'store.yaml')),
  ])
}

async function trackStoreGitHealth(rootPath: string): Promise<void> {
  const dotGitPath = join(rootPath, '.git')
  const [dotGitContent] = await Promise.all([
    reactiveReadFile(dotGitPath),
    reactiveStat(dotGitPath),
  ])
  if (!dotGitContent) {
    await reactiveReadFile(join(dotGitPath, 'config'))
    return
  }

  const gitDirMatch = /^gitdir:\s*(.+)$/im.exec(dotGitContent)
  if (!gitDirMatch?.[1]) return
  const gitDir = resolve(rootPath, gitDirMatch[1].trim())
  const commonDirContent = await reactiveReadFile(join(gitDir, 'commondir'))
  const commonDir = commonDirContent ? resolve(gitDir, commonDirContent.trim()) : gitDir
  await reactiveReadFile(join(commonDir, 'config'))
}

/** Bind fixed inputs before CLI execution so a concurrent physical change retires that result. */
export async function trackRootContextStaticDependencies(input: {
  launchProjectDir: string
  dataScopePath: string
}): Promise<void> {
  await Promise.all([
    reactiveReadFile(join(input.launchProjectDir, 'openspec', 'config.yaml')),
    reactiveReadFile(join(input.launchProjectDir, 'openspec', 'config.yml')),
    reactiveReadFile(join(input.dataScopePath, 'stores', 'registry.yaml')),
  ])
}

/** Register reactive file dependencies that can change Root Context selection. */
export async function trackRootContextDependencies(
  source: RootContextDependencySource,
  state: RootContextResolvedState
): Promise<void> {
  const attempt = currentAttempt(state)
  await Promise.all([
    trackRootContextStaticDependencies({
      launchProjectDir: source.projectDir,
      dataScopePath: attempt.dataScope.path,
    }),
    ...(attempt.planningRoot
      ? [
          trackOpenSpecRootHealth(attempt.planningRoot.path),
          ...(attempt.storeId ? [trackStoreGitHealth(attempt.planningRoot.path)] : []),
        ]
      : []),
    ...attempt.references.flatMap((reference) =>
      reference.root ? [trackOpenSpecRootHealth(reference.root)] : []
    ),
  ])
}

/** Resolve the query projection without creating long-lived reactive dependencies. */
export function resolveServerRootContext(
  source: RootContextServerSource
): Promise<RootContextResolvedState> {
  return resolveRootContext({
    launchProjectDir: source.projectDir,
    cliExecutor: source.cliExecutor,
    now: source.now,
  })
}

/** Retain the last successful snapshot when a refresh attempt returns CLI-owned failure evidence. */
export function retainStaleRootContext(
  previous: RootContext | null,
  state: RootContextResolvedState
): RootContextResolvedState {
  if (state.state === 'ready' || previous === null) return state
  return { ...state, data: previous }
}

/** Create the Root Context stream shared by all project-workspace consumers. */
export function createRootContextSubscription(source: RootContextSubscriptionSource) {
  return observable<RootContextState>((emit) => {
    const reactiveContext = new ReactiveContext()
    const controller = new AbortController()
    let previous: RootContext | null = null

    emit.next({
      state: 'loading',
      data: null,
      attempt: null,
      error: null,
      observedAt: currentTime(source),
    })

    void (async () => {
      try {
        for await (const resolved of reactiveContext.stream(async () => {
          if (previous) {
            emit.next({
              state: 'refreshing',
              data: previous,
              attempt: null,
              error: null,
              observedAt: currentTime(source),
            })
          }
          return source.resolveRootContextReactive()
        }, controller.signal)) {
          const state = retainStaleRootContext(previous, resolved)
          if (state.state === 'ready') previous = state.data
          emit.next(state)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          emit.error(error instanceof Error ? error : new Error(String(error)))
        }
      }
    })()

    return () => {
      controller.abort()
    }
  })
}
