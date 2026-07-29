/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Select and operate the Web or retained Native App presentation lifecycle.
 * 2. Keep native/browser authority credential-safe and preserve truthful browser-capable fallback.
 * 3. Center only the first retained native window without overriding later user placement.
 *
 * Original request (2026-07-29): "使用 appMode，并且 --web 只在最开始 start 的时候定好。"
 * Original request (2026-07-30): "初始使用placement center的窗口位置。"
 */
import type { WebviewNativeApiPolicy, WebviewWindowOptions } from '@opentray/ext-webview'
import type { CreateTrayMenu, CreateTrayOptions, OpenTrayRuntimeOptions } from 'opentray'
import type { DaemonExternalUrlOpener } from './browser-daemon-host.js'
import type { DaemonHostMode } from './daemon-protocol.js'
import type { DaemonPresentationHost } from './daemon-server.js'
import { buildDirectWebLaunchUrl } from './hosted-app.js'
import type { LocalAppServer } from './local-app-server.js'
import {
  productionOpenTrayPresenterDriver,
  type OpenTrayPresenterDriver,
  type PresenterTray,
} from './opentray-presenter-driver.js'

export type { OpenTrayPresenterDriver } from './opentray-presenter-driver.js'

const APP_ID = 'com.jixoai.openspecui'
const APP_TITLE = 'OpenSpecUI'
const TRAY_ID = 'openspecui-app'
const OPEN_ITEM_ID = 1
const QUIT_ITEM_ID = 2
const WINDOW_WIDTH = 1280
const WINDOW_HEIGHT = 840

type NativeApiOrigin = `http://${string}`

export interface DaemonPresenterDiagnostic {
  code:
    | 'browser-open-failed'
    | 'native-presentation-unavailable'
    | 'presenter-event-failed'
    | 'web-tray-unavailable'
  stage: string
  message: string
}

export interface OpenTrayDaemonPresenterResolution {
  effectiveHostMode: DaemonHostMode
  host: DaemonPresentationHost
  diagnostics: readonly DaemonPresenterDiagnostic[]
}

function trayMenu(visible: boolean): CreateTrayMenu {
  return {
    items: [
      {
        type: 'item',
        id: OPEN_ITEM_ID,
        title: visible ? 'Hide OpenSpecUI' : 'Open OpenSpecUI',
        primaryEvent: true,
      },
      { type: 'separator' },
      { type: 'item', id: QUIT_ITEM_ID, title: 'Quit OpenSpecUI' },
    ],
  }
}

function trayOptions(): CreateTrayOptions {
  return {
    id: TRAY_ID,
    icon: { 'text-only': 'OS' },
    tooltip: { title: APP_TITLE, description: 'OpenSpec project workspaces' },
    menu: trayMenu(false),
  }
}

function runtimeOptions(version: string): OpenTrayRuntimeOptions {
  return { appId: APP_ID, appName: APP_TITLE, packageVersion: version }
}

function requireLoopbackOrigin(appUrl: string): NativeApiOrigin {
  const parsed = new URL(appUrl)
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') {
    throw new Error('The daemon App presenter requires an IPv4 loopback HTTP origin.')
  }
  return `http://${parsed.host}`
}

function nativeWindowOptions(appUrl: string, platform: NodeJS.Platform): WebviewWindowOptions {
  const appOrigin = requireLoopbackOrigin(appUrl)
  const nativeApiPolicy: WebviewNativeApiPolicy = {
    defaultSrc: ["'none'"],
    window: [appOrigin],
  }
  return {
    url: appUrl,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    title: APP_TITLE,
    nativeWindowApi: true,
    windowControlsOverlay: platform !== 'win32',
    nativeApiPolicy,
    style: {
      appMode: true,
      frameless: false,
      resizable: true,
      autoHide: false,
    },
  }
}

function presenterSupportsNative(platform: NodeJS.Platform): boolean {
  return platform === 'darwin' || platform === 'win32'
}

async function runTeardown(steps: ReadonlyArray<() => Promise<void> | void>): Promise<void> {
  let firstFailure: unknown
  for (const step of steps) {
    try {
      await step()
    } catch (error) {
      firstFailure ??= error
    }
  }
  if (firstFailure !== undefined) throw firstFailure
}

function reportEventFailure(
  report: (diagnostic: DaemonPresenterDiagnostic) => void,
  stage: string
): (error: unknown) => void {
  return () =>
    report({
      code: 'presenter-event-failed',
      stage,
      message: 'An OpenTray presentation event failed.',
    })
}

function createProjectionMethods(options: {
  appServer: LocalAppServer
  openExternalUrl: DaemonExternalUrlOpener
}) {
  return {
    setWorkspaces: (workspaces: Parameters<DaemonPresentationHost['setWorkspaces']>[0]) =>
      options.appServer.setWorkspaces(workspaces),
    async openProjectInBrowser(
      workspace: Parameters<DaemonPresentationHost['openProjectInBrowser']>[0]
    ) {
      try {
        await options.openExternalUrl(
          buildDirectWebLaunchUrl({
            baseUrl: workspace.backendUrl,
            credential: workspace.credential,
          })
        )
      } catch {
        throw new Error('Failed to open the registered Workspace in the system browser.')
      }
    },
  }
}

async function createWebPresenter(options: {
  appServer: LocalAppServer
  driver: OpenTrayPresenterDriver
  openExternalUrl: DaemonExternalUrlOpener
  onStopRequested: () => void
  report: (diagnostic: DaemonPresenterDiagnostic) => void
  version: string
}): Promise<DaemonPresentationHost> {
  let tray: PresenterTray | null = null
  const unlisten: Array<() => void> = []
  let closePromise: Promise<void> | null = null
  try {
    tray = await options.driver.createWebTray({
      tray: trayOptions(),
      runtime: runtimeOptions(options.version),
    })
    const activateFromEvent = () => {
      void activate().catch(reportEventFailure(options.report, 'web-activate'))
    }
    unlisten.push(
      tray.onMenuClick((itemId) => {
        if (itemId === OPEN_ITEM_ID) activateFromEvent()
        if (itemId === QUIT_ITEM_ID) options.onStopRequested()
      }),
      tray.onTrayClick(activateFromEvent),
      tray.onAppReopenRequested(activateFromEvent)
    )
  } catch {
    options.report({
      code: 'web-tray-unavailable',
      stage: 'create-web-tray',
      message: 'The system tray is unavailable; browser presentation remains available.',
    })
  }

  async function activate(): Promise<void> {
    try {
      await options.openExternalUrl(options.appServer.url)
    } catch {
      throw new Error('Failed to open the OpenSpecUI App in the system browser.')
    }
  }

  const projection = createProjectionMethods(options)
  const host: DaemonPresentationHost = {
    appUrl: options.appServer.url,
    capabilities: { browser: true, nativeWindow: false },
    ...projection,
    activate,
    close() {
      closePromise ??= runTeardown([
        ...unlisten.map((stop) => () => stop()),
        () => tray?.destroy(),
        () => options.appServer.close(),
      ])
      return closePromise
    },
  }

  try {
    await host.activate()
  } catch {
    options.report({
      code: 'browser-open-failed',
      stage: 'initial-web-activation',
      message: 'The App daemon is ready, but its Browser window could not be opened.',
    })
  }
  return host
}

async function createNativePresenter(options: {
  appServer: LocalAppServer
  driver: OpenTrayPresenterDriver
  openExternalUrl: DaemonExternalUrlOpener
  onStopRequested: () => void
  platform: NodeJS.Platform
  report: (diagnostic: DaemonPresenterDiagnostic) => void
  version: string
}): Promise<DaemonPresentationHost> {
  const resources = await options.driver.createNative({
    tray: trayOptions(),
    runtime: runtimeOptions(options.version),
    window: nativeWindowOptions(options.appServer.url, options.platform),
  })
  try {
    await resources.window.show()
  } catch (error) {
    await runTeardown([() => resources.window.destroy(), () => resources.tray.destroy()])
    throw error
  }
  try {
    await resources.window.placeAtScreenCenter({ width: WINDOW_WIDTH, height: WINDOW_HEIGHT })
  } catch {
    options.report({
      code: 'presenter-event-failed',
      stage: 'native-initial-placement',
      message: 'Native window could not be centered; keeping the system-selected position.',
    })
  }

  const unlisten: Array<() => void> = []
  let operation = Promise.resolve()
  let closePromise: Promise<void> | null = null
  let visible = true

  const updateMenu = () => resources.tray.setMenu(trayMenu(visible))
  const enqueue = (action: () => Promise<void>): Promise<void> => {
    const next = operation.then(action, action)
    operation = next.catch(() => {})
    return next
  }
  const activate = () =>
    enqueue(async () => {
      await resources.window.toVisible()
      await resources.window.focus()
      visible = true
      await updateMenu()
    })
  const toggle = () =>
    enqueue(async () => {
      visible = await resources.window.isVisible()
      if (visible) {
        await resources.window.close()
        visible = false
        await updateMenu()
        return
      }
      await resources.window.toVisible()
      await resources.window.focus()
      visible = true
      await updateMenu()
    })
  const activateFromEvent = () => {
    void activate().catch(reportEventFailure(options.report, 'native-activate'))
  }

  try {
    unlisten.push(
      resources.window.listenVisible((nextVisible) => {
        visible = nextVisible
        void updateMenu().catch(reportEventFailure(options.report, 'native-menu-update'))
      }),
      resources.tray.onMenuClick((itemId) => {
        if (itemId === OPEN_ITEM_ID) {
          void toggle().catch(reportEventFailure(options.report, 'native-toggle'))
        }
        if (itemId === QUIT_ITEM_ID) options.onStopRequested()
      }),
      resources.tray.onTrayClick(activateFromEvent),
      resources.tray.onAppReopenRequested(activateFromEvent)
    )
    await updateMenu()
  } catch (error) {
    await runTeardown([
      ...unlisten.map((stop) => () => stop()),
      () => resources.window.destroy(),
      () => resources.tray.destroy(),
    ])
    throw error
  }

  return {
    appUrl: options.appServer.url,
    capabilities: { browser: true, nativeWindow: true },
    ...createProjectionMethods(options),
    activate,
    close() {
      closePromise ??= runTeardown([
        ...unlisten.map((stop) => () => stop()),
        () => operation,
        () => resources.window.destroy(),
        () => resources.tray.destroy(),
        () => options.appServer.close(),
      ])
      return closePromise
    },
  }
}

/** Create and initially present the daemon-owned App through the selected OpenTray host. */
export async function createOpenTrayDaemonPresenter(options: {
  appServer: LocalAppServer
  requestedHostMode: DaemonHostMode
  version: string
  openExternalUrl: DaemonExternalUrlOpener
  onStopRequested: () => void
  platform?: NodeJS.Platform
  driver?: OpenTrayPresenterDriver
  reportDiagnostic?: (diagnostic: DaemonPresenterDiagnostic) => void
}): Promise<OpenTrayDaemonPresenterResolution> {
  const diagnostics: DaemonPresenterDiagnostic[] = []
  const report = (diagnostic: DaemonPresenterDiagnostic) => {
    diagnostics.push(diagnostic)
    options.reportDiagnostic?.(diagnostic)
  }
  const platform = options.platform ?? process.platform
  const driver = options.driver ?? productionOpenTrayPresenterDriver
  const common = { ...options, driver, platform, report }

  if (options.requestedHostMode === 'native' && presenterSupportsNative(platform)) {
    try {
      const host = await createNativePresenter(common)
      return { effectiveHostMode: 'native', host, diagnostics }
    } catch {
      report({
        code: 'native-presentation-unavailable',
        stage: 'create-native-presenter',
        message: 'Native OpenTray presentation is unavailable; using the Web presenter.',
      })
    }
  } else if (options.requestedHostMode === 'native') {
    report({
      code: 'native-presentation-unavailable',
      stage: 'platform-selection',
      message: 'Native OpenTray presentation is unsupported on this platform; using Web.',
    })
  }

  const host = await createWebPresenter(common)
  return { effectiveHostMode: 'web', host, diagnostics }
}
