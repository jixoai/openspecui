/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Preserve physical continuity when realtime list entries enter, leave, or reorder.
 * 2. Respect reduced-motion preference and browsers without the Web Animations API.
 *
 * Original request (2026-07-30): Workspaces and Stores present live backend and Store lists.
 * Project law (2026-07-30): list data changes must retain visual inertia rather than flash.
 */
import { useCallback, useLayoutEffect, useRef } from 'react'

interface ListFlowAnimationOptions {
  readonly duration?: number
}

/** Attach keyed row refs so layout changes animate through the platform Web Animations API. */
export function useListFlowAnimation(
  itemKeys: readonly string[],
  options: ListFlowAnimationOptions = {}
): (key: string) => (element: HTMLElement | null) => void {
  const elements = useRef(new Map<string, HTMLElement>())
  const previousRects = useRef(new Map<string, DOMRect>())
  const animations = useRef(new Map<string, Animation>())
  const duration = options.duration ?? 180

  const setElement = useCallback(
    (key: string) => (element: HTMLElement | null) => {
      if (element) elements.current.set(key, element)
      else elements.current.delete(key)
    },
    []
  )

  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const initial = previousRects.current.size === 0
    const nextRects = new Map<string, DOMRect>()

    for (const key of itemKeys) {
      const element = elements.current.get(key)
      if (!element) continue
      const nextRect = element.getBoundingClientRect()
      nextRects.set(key, nextRect)
      if (reducedMotion || typeof element.animate !== 'function') continue

      animations.current.get(key)?.cancel()
      const previousRect = previousRects.current.get(key)
      const animation =
        previousRect === undefined
          ? initial
            ? null
            : element.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1 }], {
                duration,
                easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
              })
          : previousRect.top === nextRect.top && previousRect.left === nextRect.left
            ? null
            : element.animate(
                [
                  {
                    transform: `translate(${previousRect.left - nextRect.left}px, ${previousRect.top - nextRect.top}px)`,
                  },
                  { transform: 'translate(0, 0)' },
                ],
                { duration, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' }
              )
      if (animation) animations.current.set(key, animation)
    }
    previousRects.current = nextRects
  }, [duration, itemKeys])

  return setElement
}
