/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Preserve Archive row identity across reactive additions and reorders.
 * 2. Run one local native View Transition for only the ArchiveList container.
 * 3. Retire late transition commits so the newest Archive subscription snapshot wins.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 */
import type { ArchiveMeta } from '@openspecui/core'
import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'

interface NativeViewTransition {
  finished: Promise<void>
}

type NativeViewTransitionDocument = Document & {
  activeViewTransition?: NativeViewTransition | null
  startViewTransition?: (update: () => void) => NativeViewTransition
}

function hasSameArchiveOrder(left: readonly ArchiveMeta[], right: readonly ArchiveMeta[]): boolean {
  return (
    left.length === right.length && left.every((archive, index) => archive.id === right[index]?.id)
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

function runArchiveListViewTransition(options: {
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
 * Keep the displayed Archive rows until their local native transition commits an id-sequence change.
 * A newer subscription snapshot retires an earlier callback before it can restore obsolete rows.
 */
export function useArchiveListContinuity(
  incomingArchives: ArchiveMeta[] | undefined,
  containerRef: RefObject<HTMLElement | null>
): ArchiveMeta[] | undefined {
  const [displayedArchives, setDisplayedArchives] = useState(incomingArchives)
  const hasCommittedInitialSnapshotRef = useRef(false)
  const previousArchivesRef = useRef<ArchiveMeta[] | undefined>(incomingArchives)
  const transitionGenerationRef = useRef(0)
  const transitionName = `vt-archive-list-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  useEffect(() => {
    if (!hasCommittedInitialSnapshotRef.current) {
      hasCommittedInitialSnapshotRef.current = true
      previousArchivesRef.current = incomingArchives
      setDisplayedArchives(incomingArchives)
      return
    }

    const previousArchives = previousArchivesRef.current
    previousArchivesRef.current = incomingArchives
    const generation = transitionGenerationRef.current + 1
    transitionGenerationRef.current = generation

    if (
      incomingArchives === undefined ||
      previousArchives === undefined ||
      hasSameArchiveOrder(previousArchives, incomingArchives)
    ) {
      setDisplayedArchives(incomingArchives)
      return
    }

    queueMicrotask(() => {
      if (transitionGenerationRef.current !== generation) return
      runArchiveListViewTransition({
        container: containerRef.current,
        transitionName,
        update: () => {
          if (transitionGenerationRef.current === generation) {
            setDisplayedArchives(incomingArchives)
          }
        },
      })
    })
  }, [containerRef, incomingArchives, transitionName])

  return displayedArchives
}
