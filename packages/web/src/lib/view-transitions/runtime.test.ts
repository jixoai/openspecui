/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify View Transition shared-element naming and cleanup across async DOM commits.
 * 2. Prove active-transition tracking installs before the first native transition.
 *
 * Original request (2026-07-15): "这是额外的工作还是可以和 live 版本保持尽可能的一致？"
 * Derived requirement (2026-07-18): Static HTML pre-render must not evaluate browser-only toolkit modules.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { setTemporaryViewTransitionNamesMock, trackActiveViewTransitionMock } = vi.hoisted(() => ({
  setTemporaryViewTransitionNamesMock: vi.fn(async () => {}),
  trackActiveViewTransitionMock: vi.fn(),
}))

vi.mock('react-dom', () => ({
  flushSync(callback: () => void) {
    callback()
  },
}))

vi.mock('view-transitions-toolkit/track-active-view-transition', () => ({
  trackActiveViewTransition: trackActiveViewTransitionMock,
}))

vi.mock('view-transitions-toolkit/misc', () => ({
  setTemporaryViewTransitionNames: setTemporaryViewTransitionNamesMock,
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
    setTemporaryViewTransitionNamesMock.mockClear()
    trackActiveViewTransitionMock.mockClear()
  })

  it('installs active-transition tracking before the first native transition starts', async () => {
    const lifecycle: string[] = []
    trackActiveViewTransitionMock.mockImplementationOnce(() => {
      lifecycle.push('track')
    })
    ;(document as TestViewTransitionDocument).startViewTransition = (update) => {
      lifecycle.push('start')
      update()
      return {
        finished: Promise.resolve(),
      }
    }

    await runViewTransition({
      intent: {
        area: 'main',
        kind: 'route-top',
        direction: 'forward',
      },
      update: () => {},
    })

    expect(lifecycle).toEqual(['track', 'start'])
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

  it('reuses the same tab-carousel element as both old and new shared entry', async () => {
    const sharedElement = document.createElement('div')
    document.body.append(sharedElement)

    let nameDuringAfterCollection = '__unset__'
    let nameAfterAfterCollection = '__unset__'

    ;(document as TestViewTransitionDocument).startViewTransition = (update) => {
      const pending = Promise.resolve(update()).then(() => {
        nameAfterAfterCollection = sharedElement.style.viewTransitionName
      })
      return {
        finished: pending.then(() => undefined),
      }
    }

    await runViewTransition({
      intent: {
        area: 'main',
        kind: 'tab-carousel',
        direction: 'forward',
      },
      collectBeforeEntries: () => [[sharedElement, 'vt-tab-edge']],
      collectAfterEntries: () => {
        nameDuringAfterCollection = sharedElement.style.viewTransitionName
        return [[sharedElement, 'vt-tab-edge']]
      },
      update: () => {},
    })

    expect(nameDuringAfterCollection).toBe('')
    expect(nameAfterAfterCollection).toBe('vt-tab-edge')
    expect(setTemporaryViewTransitionNamesMock).toHaveBeenCalledTimes(2)
  })
})
