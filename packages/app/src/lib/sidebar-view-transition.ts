/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Commit desktop sidebar expansion and collapse through one native same-document View Transition.
 * 2. Keep unsupported and reduced-motion environments on an immediate atomic state update.
 * 3. Retire stale transition direction state when rapid toggles supersede an active transition.
 *
 * Owner correction (2026-07-31): "使用VT的话，首先要把transform动画关闭。"
 */
import { flushSync } from 'react-dom'

export type SidebarViewTransitionDirection = 'collapse' | 'expand'

interface SidebarViewTransitionOptions {
  direction: SidebarViewTransitionDirection
  update(): void
}

let activeSidebarTransition: ViewTransition | null = null

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function commit(update: () => void): void {
  flushSync(update)
}

/** Commit one sidebar topology change through the browser snapshot lifecycle. */
export function runSidebarViewTransition(options: SidebarViewTransitionOptions): void {
  if (
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    prefersReducedMotion()
  ) {
    commit(options.update)
    return
  }

  try {
    activeSidebarTransition?.skipTransition()
  } catch {
    // A transition can settle between the reference read and skipTransition().
  }

  const root = document.documentElement
  root.dataset.sidebarVt = options.direction
  let updateCommitted = false

  try {
    const transition = document.startViewTransition(() => {
      commit(options.update)
      updateCommitted = true
    })
    activeSidebarTransition = transition
    void transition.finished
      .catch(() => {})
      .finally(() => {
        if (activeSidebarTransition !== transition) return
        activeSidebarTransition = null
        delete root.dataset.sidebarVt
      })
  } catch {
    if (root.dataset.sidebarVt === options.direction) {
      delete root.dataset.sidebarVt
    }
    if (!updateCommitted) commit(options.update)
  }
}
