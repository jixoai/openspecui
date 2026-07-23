/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Preserve compound Spec row identity across Catalog order changes.
 * 2. Run one local native View Transition for SpecList mutations.
 * 3. Retire late callbacks so the newest scope and Catalog snapshot wins.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 */
import { specIdentityKey, type SpecCatalogEntry } from '@openspecui/core/spec-catalog'
import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'

type SpecScope = 'owned' | 'referenced'

interface NativeViewTransition {
  finished: Promise<void>
}

type NativeViewTransitionDocument = Document & {
  activeViewTransition?: NativeViewTransition | null
  startViewTransition?: (update: () => void) => NativeViewTransition
}

function hasSameSpecOrder(left: readonly SpecCatalogEntry[], right: readonly SpecCatalogEntry[]) {
  if (left.length !== right.length) return false
  return left.every((entry, index) => {
    const rightEntry = right[index]
    return (
      rightEntry !== undefined &&
      specIdentityKey(entry.identity) === specIdentityKey(rightEntry.identity)
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

function runSpecListViewTransition(options: {
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

/** Keep the current Spec rows until a local order transition commits. */
export function useSpecListContinuity(
  incomingSpecs: SpecCatalogEntry[] | undefined,
  scope: SpecScope,
  containerRef: RefObject<HTMLElement | null>
): SpecCatalogEntry[] | undefined {
  const [displayedSpecs, setDisplayedSpecs] = useState(incomingSpecs)
  const previousSpecsRef = useRef(incomingSpecs)
  const committedScopeRef = useRef(scope)
  const generationRef = useRef(0)
  const initializedRef = useRef(false)
  const transitionName = `vt-spec-list-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  // A scope switch renders the new projection immediately, while refs are only
  // advanced after commit so StrictMode's discarded render cannot retire the wrong generation.
  const scopeChanged = committedScopeRef.current !== scope
  const shouldRenderIncoming =
    scopeChanged || !initializedRef.current || incomingSpecs === undefined

  useLayoutEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      committedScopeRef.current = scope
      previousSpecsRef.current = incomingSpecs
      setDisplayedSpecs(incomingSpecs)
      return
    }

    if (committedScopeRef.current !== scope) {
      committedScopeRef.current = scope
      previousSpecsRef.current = incomingSpecs
      generationRef.current += 1
      setDisplayedSpecs(incomingSpecs)
      return
    }

    const previous = previousSpecsRef.current
    previousSpecsRef.current = incomingSpecs
    if (previous === incomingSpecs) return

    const generation = generationRef.current + 1
    generationRef.current = generation
    if (
      incomingSpecs === undefined ||
      previous === undefined ||
      hasSameSpecOrder(previous, incomingSpecs)
    ) {
      setDisplayedSpecs(incomingSpecs)
      return
    }

    queueMicrotask(() => {
      if (generationRef.current !== generation) return
      runSpecListViewTransition({
        container: containerRef.current,
        transitionName,
        update: () => {
          if (generationRef.current !== generation) return
          setDisplayedSpecs(incomingSpecs)
        },
      })
    })
  }, [containerRef, incomingSpecs, scope, transitionName])

  return shouldRenderIncoming ? incomingSpecs : displayedSpecs
}
