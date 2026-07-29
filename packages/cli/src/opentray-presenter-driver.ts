/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Isolate the Web facade import from the Native facade-plus-WebView import boundary.
 * 2. Adapt OpenTray public handles into the narrow lifecycle ports consumed by the App presenter.
 *
 * Original request (2026-07-29): "--web 这个模式只在最开始 start 的时候定好。"
 */
import type { WebviewWindowHandle, WebviewWindowOptions } from '@opentray/ext-webview'
import type {
  CreateTrayHandle,
  CreateTrayMenu,
  CreateTrayOptions,
  OpenTrayRuntimeOptions,
} from 'opentray'

export interface PresenterTray {
  setMenu(menu: CreateTrayMenu): Promise<void>
  onMenuClick(handler: (itemId: number) => void): () => void
  onTrayClick(handler: () => void): () => void
  onAppReopenRequested(handler: () => void): () => void
  destroy(): Promise<void>
}

export interface PresenterWindow {
  show(): Promise<void>
  close(): Promise<void>
  destroy(): Promise<void>
  focus(): Promise<void>
  isVisible(): Promise<boolean>
  listenVisible(handler: (visible: boolean) => void): () => void
  toVisible(): Promise<void>
}

interface NativePresenterResources {
  tray: PresenterTray
  window: PresenterWindow
}

export interface OpenTrayPresenterDriver {
  createWebTray(options: {
    tray: CreateTrayOptions
    runtime: OpenTrayRuntimeOptions
  }): Promise<PresenterTray>
  createNative(options: {
    tray: CreateTrayOptions
    runtime: OpenTrayRuntimeOptions
    window: WebviewWindowOptions
  }): Promise<NativePresenterResources>
}

function adaptTray(tray: CreateTrayHandle): PresenterTray {
  return {
    setMenu: (menu) => tray.setMenu(menu),
    onMenuClick: (handler) => tray.onMenuClick(({ itemId }) => handler(itemId)),
    onTrayClick: (handler) => tray.onTrayClick(handler),
    onAppReopenRequested: (handler) => tray.onAppReopenRequested(handler),
    destroy: () => tray.destroy(),
  }
}

function adaptWindow(window: WebviewWindowHandle): PresenterWindow {
  return {
    show: () => window.show(),
    close: () => window.close(),
    destroy: () => window.destroy(),
    focus: () => window.focus(),
    isVisible: () => window.isVisible(),
    listenVisible: (handler) =>
      window.listen('visibleChange', ({ payload }) => handler(payload.visible)),
    toVisible: () => window.toVisible(),
  }
}

/** Production driver whose Web branch never imports or probes the WebView extension. */
export const productionOpenTrayPresenterDriver: OpenTrayPresenterDriver = {
  async createWebTray(options) {
    const { createTray } = await import('opentray')
    return adaptTray(await createTray(options.tray, options.runtime))
  },
  async createNative(options) {
    const [{ createTray }, { WebviewExt }] = await Promise.all([
      import('opentray'),
      import('@opentray/ext-webview'),
    ])
    let tray: CreateTrayHandle | null = null
    try {
      tray = await createTray(options.tray, options.runtime)
      const nativeTray = tray.extend(WebviewExt)
      return {
        tray: adaptTray(nativeTray),
        window: adaptWindow(nativeTray.createWebviewWindow(options.window)),
      }
    } catch (error) {
      try {
        await tray?.destroy()
      } catch {
        // Preserve the construction failure; this partial tray has no remaining public owner.
      }
      throw error
    }
  },
}
