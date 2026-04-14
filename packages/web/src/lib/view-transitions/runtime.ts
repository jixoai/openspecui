import { flushSync } from 'react-dom'
import { supports } from 'view-transitions-toolkit/feature-detection'
import { setTemporaryViewTransitionNames } from 'view-transitions-toolkit/misc'
import { trackActiveViewTransition } from 'view-transitions-toolkit/track-active-view-transition'
import { waitForNamedEntriesReady } from './ready-wait'
import type { VTIntent } from './route-semantics'

type NamedElementEntry = [HTMLElement, string]

interface ViewTransitionLike {
  finished: Promise<void>
}

type ViewTransitionDocument = Document & {
  activeViewTransition?: ViewTransitionLike | null
}

interface RunViewTransitionOptions {
  intent: VTIntent | null
  update: () => void
  collectBeforeEntries?: () => NamedElementEntry[]
  collectAfterEntries?: () => NamedElementEntry[]
}

let hasInstalledActiveTransitionTracking = false

function getViewTransitionDocument(): ViewTransitionDocument | null {
  if (typeof document === 'undefined') return null
  return document as ViewTransitionDocument
}

function installActiveTransitionTracking(): void {
  if (hasInstalledActiveTransitionTracking) return
  hasInstalledActiveTransitionTracking = true
  trackActiveViewTransition()
}

function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function applyEntries(entries: NamedElementEntry[]): void {
  for (const [element, name] of entries) {
    element.style.viewTransitionName = name
  }
}

function clearEntries(entries: NamedElementEntry[]): void {
  for (const [element] of entries) {
    element.style.viewTransitionName = ''
  }
}

function waitForDomCommit(): Promise<void> {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve()
  }

  const target = document.body
  if (!target) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      observer.disconnect()
      resolve()
    }

    const observer = new MutationObserver(() => {
      finish()
    })

    observer.observe(target, {
      subtree: true,
      childList: true,
      attributes: true,
    })

    setTimeout(finish, 0)
  })
}

function filterAfterEntries(
  entries: NamedElementEntry[],
  beforeEntries: NamedElementEntry[],
  intent: VTIntent
): NamedElementEntry[] {
  if (beforeEntries.length === 0) return entries
  if (intent.kind === 'tab-carousel') {
    return entries
  }
  const beforeElements = new Set(beforeEntries.map(([element]) => element))
  return entries.filter(([element]) => !beforeElements.has(element))
}

async function collectSettledAfterEntries(
  beforeEntries: NamedElementEntry[],
  collectAfterEntries: (() => NamedElementEntry[]) | undefined,
  intent: VTIntent
): Promise<NamedElementEntry[]> {
  if (!collectAfterEntries) return []

  if (intent.kind === 'route-detail' && beforeEntries.length > 0) {
    return waitForNamedEntriesReady({
      expectedNames: beforeEntries.map(([, name]) => name),
      collectEntries: () => filterAfterEntries(collectAfterEntries(), beforeEntries, intent),
    })
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const entries = filterAfterEntries(collectAfterEntries(), beforeEntries, intent)
    if (entries.length > 0 || beforeEntries.length === 0) {
      return entries
    }

    await Promise.resolve()
    await waitForDomCommit()
  }

  return filterAfterEntries(collectAfterEntries(), beforeEntries, intent)
}

function setIntentDataset(intent: VTIntent): () => void {
  const root = document.documentElement
  root.dataset.vtKind = intent.kind
  root.dataset.vtArea = intent.area
  if (intent.direction) {
    root.dataset.vtDirection = intent.direction
  } else {
    delete root.dataset.vtDirection
  }

  return () => {
    delete root.dataset.vtKind
    delete root.dataset.vtArea
    delete root.dataset.vtDirection
  }
}

function cleanupTemporaryEntries(vt: ViewTransitionLike, entries: NamedElementEntry[]): void {
  if (entries.length === 0) return
  void setTemporaryViewTransitionNames(entries, vt.finished)
}

export function ensureViewTransitionsReady(): void {
  if (!supports.sameDocument) return
  installActiveTransitionTracking()
}

export function runViewTransition(options: RunViewTransitionOptions): Promise<void> {
  const doc = getViewTransitionDocument()
  if (!doc || !options.intent || !supports.sameDocument || isReducedMotionPreferred()) {
    flushSync(() => options.update())
    return Promise.resolve()
  }
  const intent = options.intent

  ensureViewTransitionsReady()

  if (typeof doc.startViewTransition !== 'function' || doc.activeViewTransition) {
    flushSync(() => options.update())
    return Promise.resolve()
  }

  const beforeEntries = options.collectBeforeEntries?.() ?? []
  applyEntries(beforeEntries)

  const clearIntentDataset = setIntentDataset(intent)
  let afterEntries: NamedElementEntry[] = []
  let resolveAfterEntriesReady: (entries: NamedElementEntry[]) => void = () => {}
  let rejectAfterEntriesReady: (error: unknown) => void = () => {}
  const afterEntriesReady = new Promise<NamedElementEntry[]>((resolve, reject) => {
    resolveAfterEntriesReady = resolve
    rejectAfterEntriesReady = reject
  })

  try {
    const updateTransition =
      options.collectAfterEntries == null
        ? () => {
            try {
              flushSync(() => {
                options.update()
              })
              resolveAfterEntriesReady(afterEntries)
            } catch (error) {
              rejectAfterEntriesReady(error)
              throw error
            }
          }
        : async () => {
            try {
              flushSync(() => {
                options.update()
              })

              // The old snapshot has already been captured. Clear previous names before
              // assigning next-frame names so the new DOM never contains duplicates.
              clearEntries(beforeEntries)

              afterEntries = await collectSettledAfterEntries(
                beforeEntries,
                options.collectAfterEntries,
                intent
              )
              applyEntries(afterEntries)
              resolveAfterEntriesReady(afterEntries)
              return afterEntries
            } catch (error) {
              rejectAfterEntriesReady(error)
              throw error
            }
          }

    const vt = doc.startViewTransition(updateTransition) as ViewTransitionLike

    cleanupTemporaryEntries(vt, beforeEntries)
    void afterEntriesReady
      .then((entries) => {
        cleanupTemporaryEntries(vt, entries)
      })
      .catch(() => {})

    return vt.finished
      .catch(() => {})
      .finally(() => {
        clearEntries(beforeEntries)
        clearEntries(afterEntries)
        clearIntentDataset()
      })
  } catch {
    rejectAfterEntriesReady(new Error('startViewTransition failed'))
    clearEntries(beforeEntries)
    clearEntries(afterEntries)
    clearIntentDataset()
    flushSync(() => options.update())
    return Promise.resolve()
  }
}
