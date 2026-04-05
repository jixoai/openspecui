import { createViewTransitionWaitIndicatorController } from './wait-indicator'

type NamedElementEntry = [HTMLElement, string]

interface WaitForNamedEntriesReadyOptions {
  collectEntries: () => NamedElementEntry[]
  expectedNames: string[]
  timeoutMs?: number
  indicatorDelayMs?: number
}

const READY_WAIT_TIMEOUT_MS = 1_500
const READY_WAIT_INDICATOR_DELAY_MS = 140
function hasExpectedNames(entries: NamedElementEntry[], expectedNames: readonly string[]): boolean {
  if (expectedNames.length === 0) return true
  const names = new Set(entries.map(([, name]) => name))
  return expectedNames.every((name) => names.has(name))
}

export async function waitForNamedEntriesReady({
  collectEntries,
  expectedNames,
  timeoutMs = READY_WAIT_TIMEOUT_MS,
  indicatorDelayMs = READY_WAIT_INDICATOR_DELAY_MS,
}: WaitForNamedEntriesReadyOptions): Promise<NamedElementEntry[]> {
  const initialEntries = collectEntries()
  if (hasExpectedNames(initialEntries, expectedNames)) {
    return initialEntries
  }

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return initialEntries
  }

  const indicator = createViewTransitionWaitIndicatorController()
  indicator.schedule(indicatorDelayMs)

  return new Promise<NamedElementEntry[]>((resolve) => {
    let settled = false
    let latestEntries = initialEntries

    const finish = (entries: NamedElementEntry[]) => {
      if (settled) return
      settled = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      observer?.disconnect()
      document.removeEventListener('keydown', onKeyDown, true)
      indicator.hide()
      resolve(entries)
    }

    const checkReady = () => {
      latestEntries = collectEntries()
      if (hasExpectedNames(latestEntries, expectedNames)) {
        finish(latestEntries)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      finish(latestEntries)
    }

    const observer =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            checkReady()
          })

    observer?.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    })

    document.addEventListener('keydown', onKeyDown, true)

    const timeoutId =
      timeoutMs > 0
        ? window.setTimeout(() => {
            finish(latestEntries)
          }, timeoutMs)
        : null

    checkReady()
  })
}
