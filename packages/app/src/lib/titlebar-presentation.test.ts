/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove exhaustive Browser/OpenTray/native-frame titlebar source selection.
 * 2. Prove source replacement retires listeners and rejects late async geometry.
 * 3. Prove OpenTray drag is exclusive to the dedicated App titlebar.
 * 4. Prove measured controls receive margin while pending overlay geometry keeps edge fallback.
 *
 * Original request (2026-07-29): "PWA 和 OpenTray 的标题栏 inset 不能叠加。"
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 * Owner correction (2026-07-30): follow skill-creator-v2 horizontal window-controls safe-area behavior.
 * Owner correction (2026-07-30): a host declaration outranks an overlay visible hint for measurement.
 * Owner correction (2026-07-31): PWA overlay presentation is retired.
 */
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  createAppTitlebarPresentationOwner,
  type AppTitlebarPresentation,
  type AppTitlebarRuntime,
  type OpenTrayGeometryEvent,
} from './titlebar-presentation'

function deferred<T>() {
  let resolvePromise: ((value: T) => void) | null = null
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value: T) {
      if (!resolvePromise) throw new Error('Deferred promise is unavailable.')
      resolvePromise(value)
    },
  }
}

describe('App titlebar presentation owner', () => {
  it('measures a host-declared OpenTray overlay even when its visible hint is false', async () => {
    const changes: AppTitlebarPresentation[] = []
    const getTitlebarAreaRect = vi.fn(async () => ({ x: 70, y: 0, width: 1000, height: 40 }))
    const owner = createAppTitlebarPresentationOwner({
      readRuntime: () => ({
        viewportWidth: 1200,
        declaredOpenTrayOverlay: true,
        openTrayWindow: {
          overlay: { visible: false, getTitlebarAreaRect },
        },
      }),
      onChange: (presentation) => changes.push(presentation),
    })

    await owner.start()

    expect(changes.at(-1)).toEqual({
      kind: 'opentray',
      insets: { left: 74, right: 134, top: 0, height: 40 },
    })
    expect(getTitlebarAreaRect).toHaveBeenCalledOnce()
    owner.stop()
  })

  it('selects one source, replaces rather than adds insets, and retires each listener', async () => {
    const nativeListener: { current: ((event: OpenTrayGeometryEvent) => void) | null } = {
      current: null,
    }
    const stopNative = vi.fn(async () => {})
    let runtime: AppTitlebarRuntime = {
      viewportWidth: 1200,
      openTrayWindow: {
        overlay: {
          getTitlebarAreaRect: async () => ({ x: 80, y: 0, width: 1000, height: 44 }),
          listen: async (_type, listener) => {
            nativeListener.current = listener
            return stopNative
          },
        },
      },
    }
    const changes: AppTitlebarPresentation[] = []
    const owner = createAppTitlebarPresentationOwner({
      readRuntime: () => runtime,
      onChange: (presentation) => changes.push(presentation),
    })

    await owner.start()
    expect(changes.at(-1)).toEqual({
      kind: 'opentray',
      insets: { left: 84, right: 124, top: 0, height: 44 },
    })
    const emitNativeGeometry = nativeListener.current
    if (!emitNativeGeometry) throw new Error('OpenTray geometry listener was not installed.')
    emitNativeGeometry({ titlebarAreaRect: { x: 90, y: 0, width: 1010, height: 46 } })
    expect(changes.at(-1)).toEqual({
      kind: 'opentray',
      insets: { left: 94, right: 104, top: 0, height: 46 },
    })

    runtime = { viewportWidth: 1200, openTrayWindow: {} }
    await owner.refresh()
    expect(stopNative).toHaveBeenCalledOnce()
    expect(changes.at(-1)).toEqual({ kind: 'native-frame', insets: expectZeroInsets() })

    runtime = { viewportWidth: 1200 }
    await owner.refresh()
    expect(changes.at(-1)).toEqual({ kind: 'browser', insets: expectZeroInsets() })
    owner.stop()
  })

  it('keeps a replacement Browser source after an older OpenTray measurement arrives late', async () => {
    const geometry = deferred<{ x: number; y: number; width: number; height: number }>()
    const listen = vi.fn()
    let runtime: AppTitlebarRuntime = {
      viewportWidth: 1000,
      openTrayWindow: {
        overlay: { getTitlebarAreaRect: () => geometry.promise, listen },
      },
    }
    const changes: AppTitlebarPresentation[] = []
    const owner = createAppTitlebarPresentationOwner({
      readRuntime: () => runtime,
      onChange: (presentation) => changes.push(presentation),
    })

    const pendingNative = owner.start()
    await Promise.resolve()
    runtime = { viewportWidth: 1000 }
    await owner.refresh()
    geometry.resolve({ x: 70, y: 0, width: 860, height: 44 })
    await pendingNative

    expect(changes.at(-1)).toEqual({ kind: 'browser', insets: expectZeroInsets() })
    expect(listen).not.toHaveBeenCalled()
    owner.stop()
  })

  it('starts native drag only from non-interactive dedicated App titlebar space', async () => {
    const startAppRegionDrag = vi.fn(async () => ({}))
    const root = document.createElement('div')
    root.innerHTML = `
      <header data-app-titlebar="true">
        <span data-blank></span>
        <button>Titlebar action</button>
        <input aria-label="Filter" />
        <a href="#workspace">Workspace</a>
        <span data-tabs-actions="true"><span data-action></span></span>
        <span data-tabs-tab-actions="true"><span data-tab-action></span></span>
      </header>
      <div class="tabs-header"><button data-tab>Workspace tab</button></div>
    `
    const blank = root.querySelector('[data-blank]')
    const button = root.querySelector('button')
    const input = root.querySelector('input')
    const link = root.querySelector('a')
    const globalAction = root.querySelector('[data-action]')
    const tabAction = root.querySelector('[data-tab-action]')
    const tab = root.querySelector('[data-tab]')
    if (!blank || !button || !input || !link || !globalAction || !tabAction || !tab) {
      throw new Error('Titlebar fixture did not mount.')
    }
    const owner = createAppTitlebarPresentationOwner({
      readRuntime: () => ({
        viewportWidth: 1000,
        openTrayWindow: {
          startAppRegionDrag,
          overlay: {
            getTitlebarAreaRect: async () => ({ x: 70, y: 0, width: 860, height: 44 }),
          },
        },
      }),
      onChange: vi.fn(),
    })
    await owner.start()

    owner.startDrag({ root, target: button, clientX: 1, clientY: 2, pointerId: 3 })
    owner.startDrag({ root, target: input, clientX: 1, clientY: 2, pointerId: 3 })
    owner.startDrag({ root, target: link, clientX: 1, clientY: 2, pointerId: 3 })
    owner.startDrag({ root, target: globalAction, clientX: 1, clientY: 2, pointerId: 3 })
    owner.startDrag({ root, target: tabAction, clientX: 1, clientY: 2, pointerId: 3 })
    owner.startDrag({ root, target: tab, clientX: 1, clientY: 2, pointerId: 3 })
    owner.startDrag({ root, target: blank, clientX: 4, clientY: 5, pointerId: 6 })
    expect(startAppRegionDrag).toHaveBeenCalledOnce()
    expect(startAppRegionDrag).toHaveBeenCalledWith({ x: 4, y: 5, pointerId: 6 })
    owner.stop()
  })
})

function expectZeroInsets() {
  return { left: 0, right: 0, top: 0, height: 0 }
}
