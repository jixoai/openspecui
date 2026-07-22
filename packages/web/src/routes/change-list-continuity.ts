/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Preserve active Change row identity across reactive list removals and reorders.
 * 2. Run one local native View Transition for only the ChangeList container.
 * 3. Retire late transition commits so a newer subscription snapshot always wins.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 */
import type { ChangeMeta } from '@openspecui/core'
import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'

interface NativeViewTransition {
  finished: Promise<void>
}

type NativeViewTransitionDocument = Document & {
  activeViewTransition?: NativeViewTransition | null
  startViewTransition?: (update: () => void) => NativeViewTransition
}

function hasSameChangeOrder(left: readonly ChangeMeta[], right: readonly ChangeMeta[]): boolean {
  return (
    left.length === right.length && left.every((change, index) => change.id === right[index]?.id)
  )
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function canStartLocalTransition(
  doc: NativeViewTransitionDocument,
  container: HTMLElement | null
): container is HTMLElement {
  return Boolean(
    container &&
      !prefersReducedMotion() &&
      typeof doc.startViewTransition === 'function' &&
      !doc.activeViewTransition
  )
}

function runChangeListViewTransition(options: {
  container: HTMLElement | null
  transitionName: string
  update: () => void
}): void {
  if (typeof document === 'undefined') {
    options.update()
    return
  }

  const container = options.container
  const doc = document as NativeViewTransitionDocument
  if (!canStartLocalTransition(doc, container)) {
    options.update()
    return
  }

  container.style.viewTransitionName = options.transitionName
  try {
    const transition = doc.startViewTransition(() => flushSync(options.update))
    void transition.finished
      .catch(() => {})
      .finally(() => {
        if (container.style.viewTransitionName === options.transitionName) {
          container.style.viewTransitionName = ''
        }
      })
  } catch {
    container.style.viewTransitionName = ''
    options.update()
  }
}

/**
 * Keep a local display snapshot until its local native transition commits an id-sequence change.
 * A newer subscription snapshot retires any pending transition callback before it can relabel rows.
 */
export function useChangeListContinuity(
  incomingChanges: ChangeMeta[] | undefined,
  containerRef: RefObject<HTMLElement | null>
): ChangeMeta[] | undefined {
  const [displayedChanges, setDisplayedChanges] = useState(incomingChanges)
  const hasCommittedInitialSnapshotRef = useRef(false)
  const previousChangesRef = useRef<ChangeMeta[] | undefined>(incomingChanges)
  const transitionGenerationRef = useRef(0)
  const transitionName = `vt-change-list-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  useEffect(() => {
    if (!hasCommittedInitialSnapshotRef.current) {
      hasCommittedInitialSnapshotRef.current = true
      previousChangesRef.current = incomingChanges
      setDisplayedChanges(incomingChanges)
      return
    }

    const previousChanges = previousChangesRef.current
    previousChangesRef.current = incomingChanges
    const generation = transitionGenerationRef.current + 1
    transitionGenerationRef.current = generation

    if (
      incomingChanges === undefined ||
      previousChanges === undefined ||
      hasSameChangeOrder(previousChanges, incomingChanges)
    ) {
      setDisplayedChanges(incomingChanges)
      return
    }

    queueMicrotask(() => {
      if (transitionGenerationRef.current !== generation) return
      runChangeListViewTransition({
        container: containerRef.current,
        transitionName,
        update: () => {
          if (transitionGenerationRef.current === generation) {
            setDisplayedChanges(incomingChanges)
          }
        },
      })
    })
  }, [containerRef, incomingChanges, transitionName])

  return displayedChanges
}
