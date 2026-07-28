/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Preserve Git entry row identity across same-binding order changes.
 * 2. Run one local native View Transition for same-binding list mutations.
 * 3. Retire late callbacks so the newest binding epoch and entry snapshot wins.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 * 6.17-D boundary: identity inside one binding is the Git entity id (`commit:<hash>` or `uncommitted`);
 * `updatedAt` is metadata. Across bindings the opaque `bindingToken` participates in physical ownership.
 */
import { getGitEntryEntityId } from '@/lib/git-panel'
import type { DashboardGitEntry, GitRepositoryScope } from '@openspecui/core'
import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'

/** Composite repository identity that must rotate physical ownership atomically. */
export interface GitListBindingEpoch {
  scope: GitRepositoryScope
  bindingToken: string | null
}

interface NativeViewTransition {
  finished: Promise<void>
}

type NativeViewTransitionDocument = Document & {
  activeViewTransition?: NativeViewTransition | null
  startViewTransition?: (update: () => void) => NativeViewTransition
}

function isSameBindingEpoch(left: GitListBindingEpoch, right: GitListBindingEpoch): boolean {
  return left.scope === right.scope && left.bindingToken === right.bindingToken
}

/** Equal length and matching per-position entity id (commit hash or `uncommitted`). Metadata is ignored. */
function hasSameEntryOrder(
  left: readonly DashboardGitEntry[],
  right: readonly DashboardGitEntry[]
): boolean {
  if (left.length !== right.length) return false
  return left.every((entry, index) => {
    const rightEntry = right[index]
    return (
      rightEntry !== undefined && getGitEntryEntityId(entry) === getGitEntryEntityId(rightEntry)
    )
  })
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function runGitListViewTransition(options: {
  container: HTMLElement | null
  transitionName: string
  update: () => void
}): void {
  if (typeof document === 'undefined') {
    options.update()
    return
  }

  const doc = document as NativeViewTransitionDocument
  if (
    !options.container ||
    prefersReducedMotion() ||
    typeof doc.startViewTransition !== 'function' ||
    doc.activeViewTransition
  ) {
    options.update()
    return
  }

  options.container.style.viewTransitionName = options.transitionName
  try {
    const transition = doc.startViewTransition(() => flushSync(options.update))
    void transition.finished
      .catch(() => {})
      .finally(() => {
        if (options.container?.style.viewTransitionName === options.transitionName) {
          options.container.style.viewTransitionName = ''
        }
      })
  } catch {
    options.container.style.viewTransitionName = ''
    options.update()
  }
}

/** Keep the current Git entry rows until a local order transition commits. */
export function useGitListContinuity(
  incomingEntries: DashboardGitEntry[] | undefined,
  binding: GitListBindingEpoch,
  containerRef: RefObject<HTMLElement | null>
): DashboardGitEntry[] | undefined {
  const [displayedEntries, setDisplayedEntries] = useState(incomingEntries)
  const previousEntriesRef = useRef(incomingEntries)
  const committedBindingRef = useRef(binding)
  const generationRef = useRef(0)
  const initializedRef = useRef(false)
  const transitionName = `vt-git-list-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  // A binding rotation renders the new projection immediately, while refs are only
  // advanced after commit so StrictMode's discarded render cannot retire the wrong generation.
  const bindingChanged = !isSameBindingEpoch(committedBindingRef.current, binding)
  const shouldRenderIncoming =
    bindingChanged || !initializedRef.current || incomingEntries === undefined

  useLayoutEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      committedBindingRef.current = binding
      previousEntriesRef.current = incomingEntries
      setDisplayedEntries(incomingEntries)
      return
    }

    if (!isSameBindingEpoch(committedBindingRef.current, binding)) {
      committedBindingRef.current = binding
      previousEntriesRef.current = incomingEntries
      generationRef.current += 1
      setDisplayedEntries(incomingEntries)
      return
    }

    const previous = previousEntriesRef.current
    previousEntriesRef.current = incomingEntries
    if (previous === incomingEntries) return

    const generation = generationRef.current + 1
    generationRef.current = generation
    if (
      incomingEntries === undefined ||
      previous === undefined ||
      hasSameEntryOrder(previous, incomingEntries)
    ) {
      setDisplayedEntries(incomingEntries)
      return
    }

    queueMicrotask(() => {
      if (generationRef.current !== generation) return
      runGitListViewTransition({
        container: containerRef.current,
        transitionName,
        update: () => {
          if (generationRef.current !== generation) return
          setDisplayedEntries(incomingEntries)
        },
      })
    })
  }, [containerRef, incomingEntries, binding.scope, binding.bindingToken, transitionName])

  return shouldRenderIncoming ? incomingEntries : displayedEntries
}
