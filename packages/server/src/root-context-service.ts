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
  resolveRootContext,
  type RootContext,
  type RootContextCli,
  type RootContextResolvedState,
  type RootContextState,
} from '@openspecui/core'
import { observable } from '@trpc/server/observable'
import { join } from 'node:path'

/** Server-side dependencies for one Root Context resolution attempt. */
export interface RootContextServerSource {
  projectDir: string
  cliExecutor: RootContextCli
  now?: () => number
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

/** Register reactive file dependencies that can change Root Context selection. */
export async function trackRootContextDependencies(
  source: RootContextServerSource,
  state: RootContextResolvedState
): Promise<void> {
  const attempt = currentAttempt(state)
  const paths = new Set([
    join(source.projectDir, 'openspec', 'config.yaml'),
    join(attempt.dataScope.path, 'stores', 'registry.yaml'),
  ])
  if (attempt.planningRoot) {
    paths.add(join(attempt.planningRoot.path, 'openspec', 'config.yaml'))
  }
  await Promise.all([...paths].map((path) => reactiveReadFile(path)))
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
