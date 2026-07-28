/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Define the transport-agnostic eight-topology realtime projection state law.
 * 2. Derive that state from the raw five-signal subscription/query input without erasing source facts.
 * 3. Keep authority and cause orthogonal to the visual topology so atoms receive them as data attributes.
 *
 * Original request (2026-07-23): "不用显示文字，可以用光影来替代，将它做成一种视觉语言，其实包括加载中等状态也是。"
 * Reviewer replan (2026-07-24): Web-first; the adapter targets the current v1 transport. P1 later swaps the
 * transport layer, but this state-law output contract stays unchanged, so atoms and routes require no change.
 *
 * Compromise: this module is pure derivation with no transport coupling. It must not invent a second client
 * truth source; it normalizes existing subscription/query signals into one presentation topology.
 */

/**
 * The normalized visual topology for one projection region.
 *
 * No readable content: `idle | initial-loading | empty | initial-error`
 * Readable content:    `partial | current | revalidating | refresh-error`
 *
 * A region is `empty` only when a current projection committed with no items; an unresolved request is
 * `initial-loading`, never an empty result.
 */
export type RealtimeProjectionTopology =
  | 'idle'
  | 'initial-loading'
  | 'empty'
  | 'initial-error'
  | 'partial'
  | 'current'
  | 'revalidating'
  | 'refresh-error'

/**
 * Operation authority is independent from loading presentation. Readable `display-only` content stays
 * readable/selectable/copyable but never grants current-dependent mutation authority.
 */
export type RealtimeProjectionAuthority = 'current' | 'display-only'

/**
 * The typed cause of the current wait, kept orthogonal to topology. `server-push` arrives only after P1;
 * under v1 transport the adapter derives `reconnect`/`user-action`/`root-rebind` from the existing signals.
 */
export type RealtimeProjectionCause =
  | 'initial'
  | 'server-push'
  | 'user-action'
  | 'reconnect'
  | 'root-rebind'

/**
 * Explicit progress when known; the literal `unknown` forbids fabricated percentages or ETA. Atoms render an
 * indeterminate arrival cue only when `total === 'unknown'`.
 */
export interface RealtimeProjectionProgress {
  completed: number
  total: number | 'unknown'
}

/**
 * The headless state law consumed by composable visual atoms. The `data` field carries readable content when
 * present; atoms decide whether to render it based on `topology`, never on a separate `isLoading` boolean.
 */
export interface RealtimeProjectionState<T, TMeta = unknown> {
  topology: RealtimeProjectionTopology
  authority: RealtimeProjectionAuthority
  cause: RealtimeProjectionCause
  data: T | undefined
  error: Error | null
  progress: RealtimeProjectionProgress | null
  meta: TMeta | undefined
}

/**
 * Raw input to the derivation. These are the five signals every existing subscription/query hook already
 * produces; the adapter gathers them without erasing source-specific metadata.
 */
export interface RealtimeProjectionInput<T> {
  data: T | undefined
  /** True only while the first authoritative payload has not yet arrived (no readable content). */
  isLoading: boolean
  /** True while a dependency-driven recompute or background revalidation is pending over readable content. */
  isUpdating: boolean
  error: Error | null
  /** Whether the projection grants current-dependent mutation authority. */
  authority: 'current' | 'display-only'
  cause: RealtimeProjectionCause
  progress: RealtimeProjectionProgress | null
}

/**
 * Decide whether committed data should be treated as empty. A projection that has never committed is not
 * empty; only a current projection with zero items is empty. Callers pass a projection-specific predicate.
 */
export type RealtimeProjectionEmptyPredicate<T> = (data: T) => boolean

function isEmptyArrayOrNever<T>(
  data: T | undefined,
  isEmpty: RealtimeProjectionEmptyPredicate<T> | undefined
): boolean {
  if (data === undefined) return false
  if (isEmpty !== undefined) return isEmpty(data)
  return Array.isArray(data) && data.length === 0
}

/**
 * Derive the eight-topology state from the raw five-signal input.
 *
 * Laws preserved:
 * - An unresolved request is `initial-loading`, never `empty`.
 * - Readable content stays visible during `revalidating`/`refresh-error`; only `authority` revokes.
 * - Unknown totals never become percentages or ETA (atoms render an indeterminate cue only).
 */
export function deriveProjectionState<T, TMeta = undefined>(
  input: RealtimeProjectionInput<T>,
  options: {
    isEmpty?: RealtimeProjectionEmptyPredicate<T>
    meta?: TMeta
  } = {}
): RealtimeProjectionState<T, TMeta> {
  const { data, isLoading, isUpdating, error, authority, cause, progress } = input
  const hasContent = data !== undefined

  if (!hasContent) {
    // No readable content.
    if (error !== null && !isLoading) {
      return {
        topology: 'initial-error',
        authority: 'display-only',
        cause,
        data: undefined,
        error,
        progress: null,
        meta: options.meta,
      }
    }
    if (isLoading) {
      return {
        topology: 'initial-loading',
        authority: 'display-only',
        cause,
        data: undefined,
        error: null,
        progress,
        meta: options.meta,
      }
    }
    // No loading, no error, no data: only `current` authority signals a committed empty result. A neutral
    // display-only state with no activity is `idle` (nothing has been requested or settled yet).
    if (authority === 'current') {
      return {
        topology: 'empty',
        authority,
        cause,
        data: undefined,
        error: null,
        progress: null,
        meta: options.meta,
      }
    }
    return {
      topology: 'idle',
      authority: 'display-only',
      cause,
      data: undefined,
      error: null,
      progress: null,
      meta: options.meta,
    }
  }

  // Readable content present.
  if (error !== null) {
    return {
      topology: 'refresh-error',
      authority: 'display-only',
      cause,
      data,
      error,
      progress,
      meta: options.meta,
    }
  }
  if (isUpdating) {
    return {
      topology: 'revalidating',
      authority: 'display-only',
      cause,
      data,
      error: null,
      progress,
      meta: options.meta,
    }
  }
  if (isLoading) {
    // Transport revalidation over readable content without an explicit isUpdating signal.
    return {
      topology: 'revalidating',
      authority: 'display-only',
      cause,
      data,
      error: null,
      progress,
      meta: options.meta,
    }
  }
  if (authority !== 'current') {
    // Readable but not authoritative: retained display-only content (e.g. during reconnect/root-rebind).
    return {
      topology: 'revalidating',
      authority: 'display-only',
      cause,
      data,
      error: null,
      progress,
      meta: options.meta,
    }
  }
  // Current and settled. `empty` is only reachable when committed current content is empty.
  if (isEmptyArrayOrNever(data, options.isEmpty)) {
    return {
      topology: 'empty',
      authority: 'current',
      cause,
      data,
      error: null,
      progress: null,
      meta: options.meta,
    }
  }
  // Progressive work before completion exposes received rows as `partial`.
  if (progress !== null && progress.total !== 'unknown' && progress.completed < progress.total) {
    return {
      topology: 'partial',
      authority: 'current',
      cause,
      data,
      error: null,
      progress,
      meta: options.meta,
    }
  }
  if (progress !== null && progress.total === 'unknown') {
    return {
      topology: 'partial',
      authority: 'current',
      cause,
      data,
      error: null,
      progress,
      meta: options.meta,
    }
  }
  return {
    topology: 'current',
    authority: 'current',
    cause,
    data,
    error: null,
    progress,
    meta: options.meta,
  }
}
