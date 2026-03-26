import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

export interface VisibilityBatchEntry<TId extends string> {
  id: TId
  entry: IntersectionObserverEntry
}

interface UseIntersectionVisibilityMapOptions<TId extends string> {
  ids?: readonly TId[]
  root?: HTMLElement | null
  rootMargin?: string
  threshold?: readonly number[]
  onBecomeVisible?: (entries: VisibilityBatchEntry<TId>[]) => void
}

export function buildIntersectionThresholds(steps: number): number[] {
  return Array.from({ length: steps + 1 }, (_, index) => index / steps)
}

export function isVerticalScrollIntentKey(key: string): boolean {
  return (
    key === 'ArrowDown' ||
    key === 'ArrowUp' ||
    key === 'PageDown' ||
    key === 'PageUp' ||
    key === 'Home' ||
    key === 'End' ||
    key === ' '
  )
}

function hasVerticalScrollBehavior(overflowY: string): boolean {
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
}

export function findVerticalScrollContainer(
  node: HTMLElement | null,
  options: {
    allowNonScrollable?: boolean
  } = {}
): HTMLElement | null {
  const { allowNonScrollable = false } = options
  let current = node?.parentElement ?? null

  while (current) {
    const style = window.getComputedStyle(current)
    if (hasVerticalScrollBehavior(style.overflowY)) {
      if (allowNonScrollable || current.scrollHeight > current.clientHeight) {
        return current
      }
    }
    current = current.parentElement
  }

  return null
}

export function revealElementInContainer(options: {
  container: HTMLElement
  element: HTMLElement
  behavior?: ScrollBehavior
  margin?: number
}): void {
  const { container, element, behavior = 'auto', margin = 8 } = options
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const relativeTop = elementRect.top - containerRect.top
  const relativeBottom = elementRect.bottom - containerRect.top

  if (relativeTop < margin) {
    container.scrollTo({
      top: Math.max(container.scrollTop + relativeTop - margin, 0),
      behavior,
    })
    return
  }

  if (relativeBottom > containerRect.height - margin) {
    container.scrollTo({
      top: container.scrollTop + relativeBottom - containerRect.height + margin,
      behavior,
    })
  }
}

function scrollViewportBounds(root: HTMLElement | null): { top: number; bottom: number } {
  if (root) {
    const rect = root.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
    }
  }

  return {
    top: 0,
    bottom: window.innerHeight,
  }
}

export function measureAvailableViewportHeight(
  node: HTMLElement | null,
  root: HTMLElement | null = findVerticalScrollContainer(node, { allowNonScrollable: true })
): number | null {
  if (typeof window === 'undefined' || !node) {
    return null
  }

  const nodeRect = node.getBoundingClientRect()
  const viewport = scrollViewportBounds(root)
  return Math.max(Math.floor(viewport.bottom - Math.max(nodeRect.top, viewport.top)), 0)
}

export function useViewportConstrainedHeight({
  target,
  enabled = true,
}: {
  target: HTMLElement | null
  enabled?: boolean
}): number | null {
  const [height, setHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setHeight(null)
      return
    }

    if (!target) {
      setHeight(null)
      return
    }

    let resizeObserver: ResizeObserver | null = null
    let scrollRoot: HTMLElement | null = null
    let scrollTarget: Window | HTMLElement = window

    const setConstrainedHeight = (nextHeight: number | null) => {
      setHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight))
    }

    const bindScrollRoot = (nextRoot: HTMLElement | null) => {
      if (scrollRoot === nextRoot) {
        return
      }

      scrollTarget.removeEventListener('scroll', handleUpdate)
      if (resizeObserver && scrollRoot) {
        resizeObserver.unobserve(scrollRoot)
      }

      scrollRoot = nextRoot
      scrollTarget = nextRoot ?? window
      scrollTarget.addEventListener('scroll', handleUpdate, { passive: true })

      if (resizeObserver && scrollRoot) {
        resizeObserver.observe(scrollRoot)
      }
    }

    const handleUpdate = () => {
      const nextRoot = findVerticalScrollContainer(target, { allowNonScrollable: true })
      bindScrollRoot(nextRoot)
      setConstrainedHeight(measureAvailableViewportHeight(target, nextRoot))
    }

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleUpdate()
      })
      resizeObserver.observe(target)
      if (target.parentElement) {
        resizeObserver.observe(target.parentElement)
      }
    }

    handleUpdate()
    window.addEventListener('resize', handleUpdate)

    return () => {
      window.removeEventListener('resize', handleUpdate)
      scrollTarget.removeEventListener('scroll', handleUpdate)
      resizeObserver?.disconnect()
    }
  }, [enabled, target])

  return height
}

export function pickRevealTargetId<TId extends string>(
  entries: VisibilityBatchEntry<TId>[]
): TId | null {
  if (entries.length === 0) {
    return null
  }

  const sortedEntries = [...entries].sort(
    (left, right) => left.entry.boundingClientRect.top - right.entry.boundingClientRect.top
  )
  const entersFromTop = sortedEntries.some(({ entry }) => {
    const rootTop = entry.rootBounds?.top ?? 0
    return entry.boundingClientRect.top <= rootTop + 1
  })

  return (entersFromTop ? sortedEntries[0] : sortedEntries.at(-1))?.id ?? null
}

export function useIntersectionVisibilityMap<TId extends string>({
  ids,
  root = null,
  rootMargin,
  threshold,
  onBecomeVisible,
}: UseIntersectionVisibilityMapOptions<TId>) {
  const nodesRef = useRef(new Map<TId, HTMLElement>())
  const idByNodeRef = useRef(new Map<HTMLElement, TId>())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const ratioByIdRef = useRef(new Map<TId, number>())
  const [ratioByIdState, setRatioByIdState] = useState<Map<TId, number>>(() => new Map())
  const onBecomeVisibleRef = useRef(onBecomeVisible)

  onBecomeVisibleRef.current = onBecomeVisible

  const thresholdKey = useMemo(() => JSON.stringify(threshold ?? [0]), [threshold])

  const setRatioById = useCallback((next: Map<TId, number>) => {
    ratioByIdRef.current = next
    setRatioByIdState(new Map(next))
  }, [])

  useEffect(() => {
    if (!ids) return

    const allowedIds = new Set(ids)
    let changed = false

    for (const [id, node] of nodesRef.current.entries()) {
      if (allowedIds.has(id)) continue
      observerRef.current?.unobserve(node)
      nodesRef.current.delete(id)
      idByNodeRef.current.delete(node)
      changed = true
    }

    const nextRatioById = new Map(ratioByIdRef.current)
    for (const id of nextRatioById.keys()) {
      if (allowedIds.has(id)) continue
      nextRatioById.delete(id)
      changed = true
    }

    if (changed) {
      setRatioById(nextRatioById)
    }
  }, [ids, setRatioById])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const nextRatioById = new Map(ratioByIdRef.current)
        const becameVisible: VisibilityBatchEntry<TId>[] = []

        for (const entry of entries) {
          const node = entry.target as HTMLElement
          const id = idByNodeRef.current.get(node)
          if (!id) continue

          const nextRatio = entry.isIntersecting ? entry.intersectionRatio : 0
          const previousRatio = ratioByIdRef.current.get(id) ?? 0

          if (nextRatio > 0) {
            nextRatioById.set(id, nextRatio)
          } else {
            nextRatioById.delete(id)
          }

          if (previousRatio <= 0 && nextRatio > 0) {
            becameVisible.push({ id, entry })
          }
        }

        setRatioById(nextRatioById)

        if (becameVisible.length > 0) {
          onBecomeVisibleRef.current?.(becameVisible)
        }
      },
      {
        root,
        rootMargin,
        threshold: threshold ? [...threshold] : undefined,
      }
    )

    observerRef.current = observer

    for (const node of nodesRef.current.values()) {
      observer.observe(node)
    }

    return () => {
      observer.disconnect()
      if (observerRef.current === observer) {
        observerRef.current = null
      }
    }
  }, [root, rootMargin, setRatioById, thresholdKey, threshold])

  const setObservedNode = useCallback(
    (id: TId, node: HTMLElement | null) => {
      const previousNode = nodesRef.current.get(id)
      if (previousNode === node) {
        return
      }

      if (previousNode) {
        observerRef.current?.unobserve(previousNode)
        nodesRef.current.delete(id)
        idByNodeRef.current.delete(previousNode)

        const nextRatioById = new Map(ratioByIdRef.current)
        if (nextRatioById.delete(id)) {
          setRatioById(nextRatioById)
        }
      }

      if (!node) {
        return
      }

      nodesRef.current.set(id, node)
      idByNodeRef.current.set(node, id)
      observerRef.current?.observe(node)
    },
    [setRatioById]
  )

  return {
    ratioById: ratioByIdState as ReadonlyMap<TId, number>,
    setObservedNode,
  }
}
