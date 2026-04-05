import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-dom', () => ({
  flushSync(callback: () => void) {
    callback()
  },
}))

vi.mock('view-transitions-toolkit/feature-detection', () => ({
  supports: {
    sameDocument: true,
  },
}))

vi.mock('view-transitions-toolkit/track-active-view-transition', () => ({
  trackActiveViewTransition: vi.fn(),
}))

vi.mock('view-transitions-toolkit/misc', () => ({
  setTemporaryViewTransitionNames: vi.fn(async () => {}),
}))

import { runViewTransition } from './runtime'

interface TestViewTransition {
  finished: Promise<void>
}

type TestViewTransitionDocument = Document & {
  activeViewTransition?: TestViewTransition | null
  startViewTransition?: (update: () => void) => TestViewTransition
}

describe('runViewTransition', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete document.documentElement.dataset.vtKind
    delete document.documentElement.dataset.vtArea
    delete document.documentElement.dataset.vtDirection
    document.getElementById('vt-ready-indicator-style')?.remove()
    const doc = document as TestViewTransitionDocument
    doc.activeViewTransition = null
    delete doc.startViewTransition
  })

  it('clears previous names before collecting the next snapshot entries', async () => {
    const beforeElement = document.createElement('div')
    const afterElement = document.createElement('div')
    document.body.append(beforeElement, afterElement)

    let beforeNameDuringAfterCollection = '__unset__'

    ;(document as TestViewTransitionDocument).startViewTransition = (update) => {
      update()
      return {
        finished: Promise.resolve(),
      }
    }

    await runViewTransition({
      intent: {
        area: 'main',
        kind: 'tab-carousel',
        direction: 'forward',
      },
      collectBeforeEntries: () => [[beforeElement, 'vt-before']],
      collectAfterEntries: () => {
        beforeNameDuringAfterCollection = beforeElement.style.viewTransitionName
        return [[afterElement, 'vt-after']]
      },
      update: () => {},
    })

    expect(beforeNameDuringAfterCollection).toBe('')
    expect(document.documentElement.dataset.vtKind).toBeUndefined()
    expect(document.documentElement.dataset.vtArea).toBeUndefined()
    expect(document.documentElement.dataset.vtDirection).toBeUndefined()
  })

  it('waits for distinct after entries when the new DOM arrives in a microtask', async () => {
    const beforeElement = document.createElement('div')
    const afterElement = document.createElement('div')
    afterElement.dataset.vtTestAfter = 'true'
    document.body.append(beforeElement)

    let latestCollectedElement: HTMLElement | null = null

    ;(document as TestViewTransitionDocument).startViewTransition = (update) => {
      const pending = Promise.resolve(update())
      return {
        finished: pending.then(() => undefined),
      }
    }

    await runViewTransition({
      intent: {
        area: 'main',
        kind: 'route-detail',
        direction: 'forward',
      },
      collectBeforeEntries: () => [[beforeElement, 'vt-before']],
      collectAfterEntries: () => {
        const current = document.body.firstElementChild
        if (!(current instanceof HTMLElement)) {
          return []
        }
        latestCollectedElement = current
        return [[current, 'vt-after']]
      },
      update: () => {
        queueMicrotask(() => {
          beforeElement.replaceWith(afterElement)
        })
      },
    })

    expect(latestCollectedElement?.dataset.vtTestAfter).toBe('true')
    expect(afterElement.style.viewTransitionName).toBe('')
  })

  it('waits for route-detail shared elements that arrive after an async data delay', async () => {
    const beforeElement = document.createElement('div')
    const afterElement = document.createElement('div')
    afterElement.dataset.vtTestAfter = 'true'
    document.body.append(beforeElement)
    ;(document as TestViewTransitionDocument).startViewTransition = (update) => {
      const pending = Promise.resolve(update())
      return {
        finished: pending.then(() => undefined),
      }
    }

    await runViewTransition({
      intent: {
        area: 'main',
        kind: 'route-detail',
        direction: 'forward',
      },
      collectBeforeEntries: () => [[beforeElement, 'vt-shared-card']],
      collectAfterEntries: () => {
        const current = document.body.firstElementChild
        if (!(current instanceof HTMLElement) || current.dataset.vtTestAfter !== 'true') {
          return []
        }
        return [[current, 'vt-shared-card']]
      },
      update: () => {
        setTimeout(() => {
          beforeElement.replaceWith(afterElement)
        }, 20)
      },
    })

    expect(afterElement.style.viewTransitionName).toBe('')
  })

  it('allows escape to cancel shared-element waiting', async () => {
    const beforeElement = document.createElement('div')
    document.body.append(beforeElement)
    ;(document as TestViewTransitionDocument).startViewTransition = (update) => {
      const pending = Promise.resolve(update())
      return {
        finished: pending.then(() => undefined),
      }
    }

    const pendingTransition = runViewTransition({
      intent: {
        area: 'main',
        kind: 'route-detail',
        direction: 'forward',
      },
      collectBeforeEntries: () => [[beforeElement, 'vt-shared-card']],
      collectAfterEntries: () => [],
      update: () => {},
    })

    setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    }, 20)

    await pendingTransition

    expect(document.querySelector('[data-vt-ready-indicator]')).toBeNull()
    expect(document.documentElement.dataset.vtKind).toBeUndefined()
  })
})
