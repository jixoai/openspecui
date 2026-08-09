/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Prove host-native branded appMode/DevTools bootstrap and one-shot placement through the presenter.
 * 2. Prove retained activation, hide-versus-destroy semantics, and exact final teardown order.
 * 3. Prove Web import isolation, platform selection, and native fallback truth.
 * 4. Prove native page authority uses OpenTray local matching while bootstrap remains IPv4-loopback-only.
 * 5. Preserve exact lifecycle event evidence for mutation-resistant review.
 *
 * Compromise: these five assertion groups share one checked driver fixture because splitting the
 * fixture would duplicate the same retained-window state-machine seam and weaken mutation evidence.
 *
 * Original request (2026-07-29): "多次执行 openspecui --app 只是在激活同一个 daemon。"
 * Original request (2026-07-30): "初始使用placement center的窗口位置。"
 * Owner correction (2026-07-30): "pnpm openspecui这种开发模式下，应该要启动 opentray 的 devtools。"
 * Owner correction (2026-07-30): "logo要全面应用：titlebar中、appIcon中、trayIcon中。"
 * Owner correction (2026-07-30): Native appMode persists public cold launch and delegates warm reopen.
 * Owner diagnostic decision (2026-07-30): use OpenTray's local source selector so its window bridge is injected.
 * Owner-reported defect (2026-07-31): Tray Quit must not leave the daemon App HTTP server alive.
 */
import { join } from 'node:path'
import type { OpenTrayAppLaunchOptions } from 'opentray'
import { describe, expect, it, vi } from 'vitest'
import type { LocalAppServer } from './local-app-server.js'
import {
  createOpenTrayDaemonPresenter,
  type OpenTrayPresenterDriver,
} from './opentray-daemon-presenter.js'

type NativeCreateOptions = Parameters<OpenTrayPresenterDriver['createNative']>[0]
type WebCreateOptions = Parameters<OpenTrayPresenterDriver['createWebTray']>[0]

const APP_LAUNCH: OpenTrayAppLaunchOptions = {
  command: '/runtime/node',
  args: ['/package/dist/cli.mjs', 'start'],
  cwd: '/package',
}
const APP_ASSETS_DIR = join('/package', 'app')
const appAssetPath = (...segments: string[]) => join(APP_ASSETS_DIR, ...segments)

function createFixture(
  options: {
    isVisiblePending?: boolean
    nativeFailure?: boolean
    placementFailure?: boolean
    showFailure?: boolean
    webFailure?: boolean
  } = {}
) {
  const events: string[] = []
  const nativeCalls: NativeCreateOptions[] = []
  const webCalls: WebCreateOptions[] = []
  let menuHandler: (itemId: number) => void = () => {}
  let visibleHandler: (visible: boolean) => void = () => {}
  let visible = true

  const tray = {
    setMenu: vi.fn(async () => {}),
    onMenuClick: vi.fn((handler: (itemId: number) => void) => {
      menuHandler = handler
      return () => events.push('off:menu')
    }),
    onTrayClick: vi.fn((_handler: () => void) => () => events.push('off:tray')),
    onAppReopenRequested: vi.fn((_handler: () => void) => () => events.push('off:reopen')),
    destroy: vi.fn(async () => {
      events.push('destroy:tray')
    }),
  }
  const window = {
    show: vi.fn(async () => {
      events.push('show')
      if (options.showFailure) throw new Error('native show fixture failure')
    }),
    openDevtools: vi.fn(async () => {
      events.push('open:devtools')
    }),
    placeAtScreenCenter: vi.fn(async () => {
      events.push('screen-center')
      if (options.placementFailure) throw new Error('native placement fixture failure')
    }),
    close: vi.fn(async () => {
      visible = false
      visibleHandler(false)
      events.push('close:window')
    }),
    destroy: vi.fn(async () => {
      events.push('destroy:window')
    }),
    focus: vi.fn(async () => {
      events.push('focus')
    }),
    isVisible: vi.fn(async () =>
      options.isVisiblePending
        ? await new Promise<boolean>(() => {
            // Exact regression fixture: an OpenTray visibility RPC can remain pending while Quit
            // must continue tearing down independently owned daemon resources.
          })
        : visible
    ),
    listenVisible: vi.fn((handler: (nextVisible: boolean) => void) => {
      visibleHandler = handler
      return () => events.push('off:window')
    }),
    toVisible: vi.fn(async () => {
      visible = true
      visibleHandler(true)
      events.push('toVisible')
    }),
  }
  const driver: OpenTrayPresenterDriver = {
    async createWebTray(createOptions) {
      webCalls.push(createOptions)
      if (options.webFailure) throw new Error('web tray fixture failure')
      return tray
    },
    async createNative(createOptions) {
      nativeCalls.push(createOptions)
      if (options.nativeFailure) throw new Error('native fixture failure')
      return { tray, window }
    },
  }
  const appServer: LocalAppServer = {
    url: 'http://127.0.0.1:43121',
    setWorkspaces: vi.fn(),
    setWorkspaceDirectoryCatalog: vi.fn(),
    close: vi.fn(async () => {
      events.push('close:app-server')
    }),
  }
  const opened: string[] = []
  const openExternalUrl = vi.fn(async (target: string) => {
    opened.push(target)
  })

  return {
    appServer,
    driver,
    events,
    menuHandler: (itemId: number) => menuHandler(itemId),
    nativeCalls,
    openExternalUrl,
    opened,
    tray,
    webCalls,
    window,
  }
}

describe('OpenTray daemon presenter', () => {
  it('bootstraps one native appMode window and reuses it through ordered activation', async () => {
    const fixture = createFixture()
    const resolution = await createOpenTrayDaemonPresenter({
      appAssetsDir: APP_ASSETS_DIR,
      appLaunch: APP_LAUNCH,
      appServer: fixture.appServer,
      requestedHostMode: 'native',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested: vi.fn(),
      platform: 'darwin',
      driver: fixture.driver,
    })

    expect(resolution.effectiveHostMode).toBe('native')
    expect(fixture.nativeCalls).toHaveLength(1)
    expect(fixture.nativeCalls[0]?.runtime.appIcon).toEqual([
      expect.objectContaining({
        platform: 'darwin',
        format: 'icns',
        variant: ['default', 'light'],
        source: {
          type: 'file',
          path: appAssetPath('native-icons', 'app-icon', 'darwin-light.icns'),
        },
      }),
      expect.objectContaining({
        platform: 'darwin',
        format: 'icns',
        variant: 'dark',
        source: {
          type: 'file',
          path: appAssetPath('native-icons', 'app-icon', 'darwin-dark.icns'),
        },
      }),
    ])
    expect(fixture.nativeCalls[0]?.runtime.appLaunch).toEqual(APP_LAUNCH)
    expect(fixture.tray.onAppReopenRequested).not.toHaveBeenCalled()
    expect(fixture.nativeCalls[0]?.tray.icon).toEqual({
      'darwin-icon-only': {
        type: 'file',
        path: appAssetPath('native-icons', 'tray-icon.png'),
        isTemplate: true,
      },
      'win32-icon-only': {
        type: 'file',
        path: appAssetPath('native-icons', 'tray-icon.png'),
      },
      'linux-icon-only': {
        type: 'file',
        path: appAssetPath('native-icons', 'tray-icon.png'),
      },
    })
    expect(fixture.nativeCalls[0]).toEqual(
      expect.objectContaining({
        runtime: expect.objectContaining({
          appId: 'com.jixoai.openspecui',
          appName: 'OpenSpecUI',
          packageVersion: '6.1.0',
        }),
        window: expect.objectContaining({
          url: `${fixture.appServer.url}/?appMode=opentray-overlay`,
          width: 1280,
          height: 840,
          nativeWindowApi: true,
          windowControlsOverlay: true,
          nativeApiPolicy: {
            defaultSrc: ["'none'"],
            window: ["'local'"],
          },
          style: {
            appMode: true,
            frameless: false,
            resizable: true,
            autoHide: false,
            background: { kind: 'semantic', token: 'blur', state: 'active' },
          },
        }),
      })
    )
    expect(JSON.stringify(fixture.nativeCalls[0])).not.toContain('"*"')
    expect(fixture.window.show).toHaveBeenCalledOnce()
    expect(fixture.window.placeAtScreenCenter).toHaveBeenCalledExactlyOnceWith({
      width: 1280,
      height: 840,
    })
    expect(fixture.events.slice(0, 2)).toEqual(['show', 'screen-center'])

    fixture.events.length = 0
    await resolution.host.activate()
    await resolution.host.activate()
    expect(fixture.events).toEqual(['toVisible', 'focus', 'toVisible', 'focus'])
    expect(fixture.window.show).toHaveBeenCalledOnce()
    expect(fixture.window.placeAtScreenCenter).toHaveBeenCalledOnce()
  })

  it('retains native presentation when initial placement fails', async () => {
    const fixture = createFixture({ placementFailure: true })
    const resolution = await createOpenTrayDaemonPresenter({
      appAssetsDir: '/package/app',
      appLaunch: APP_LAUNCH,
      appServer: fixture.appServer,
      requestedHostMode: 'native',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested: vi.fn(),
      platform: 'darwin',
      driver: fixture.driver,
    })

    expect(resolution.effectiveHostMode).toBe('native')
    expect(fixture.window.show).toHaveBeenCalledOnce()
    expect(fixture.window.placeAtScreenCenter).toHaveBeenCalledExactlyOnceWith({
      width: 1280,
      height: 840,
    })
    expect(resolution.diagnostics).toContainEqual({
      code: 'presenter-event-failed',
      stage: 'native-initial-placement',
      message: 'Native window could not be centered; keeping the system-selected position.',
    })
    await resolution.host.close()
  })

  it('opens instance DevTools between first show and initial placement in development', async () => {
    const fixture = createFixture()
    const resolution = await createOpenTrayDaemonPresenter({
      appAssetsDir: '/package/app',
      appLaunch: APP_LAUNCH,
      appServer: fixture.appServer,
      requestedHostMode: 'native',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested: vi.fn(),
      platform: 'darwin',
      driver: fixture.driver,
      enableDevtools: true,
    })

    expect(fixture.nativeCalls[0]?.window.devtools).toBe(true)
    expect(fixture.window.openDevtools).toHaveBeenCalledOnce()
    expect(fixture.events.slice(0, 3)).toEqual(['show', 'open:devtools', 'screen-center'])
    await resolution.host.close()
  })

  it('hides the retained window without destroying it and tears down in owner order', async () => {
    const fixture = createFixture()
    const { host } = await createOpenTrayDaemonPresenter({
      appAssetsDir: '/package/app',
      appLaunch: APP_LAUNCH,
      appServer: fixture.appServer,
      requestedHostMode: 'native',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested: vi.fn(),
      platform: 'darwin',
      driver: fixture.driver,
    })

    fixture.menuHandler(1)
    await vi.waitFor(() => expect(fixture.window.close).toHaveBeenCalledOnce())
    expect(fixture.window.destroy).not.toHaveBeenCalled()

    fixture.events.length = 0
    await host.close()
    expect(fixture.events).toEqual([
      'off:window',
      'off:menu',
      'off:tray',
      'close:app-server',
      'destroy:window',
      'destroy:tray',
    ])
  })

  it('finishes Tray Quit while a native visibility operation remains pending', async () => {
    const fixture = createFixture({ isVisiblePending: true })
    let closeHost: () => void = () => {}
    const onStopRequested = vi.fn(() => closeHost())
    const { host } = await createOpenTrayDaemonPresenter({
      appAssetsDir: '/package/app',
      appLaunch: APP_LAUNCH,
      appServer: fixture.appServer,
      requestedHostMode: 'native',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested,
      platform: 'darwin',
      driver: fixture.driver,
    })
    closeHost = () => void host.close()

    fixture.menuHandler(1)
    await vi.waitFor(() => expect(fixture.window.isVisible).toHaveBeenCalledOnce())
    fixture.menuHandler(2)

    await vi.waitFor(() => expect(fixture.appServer.close).toHaveBeenCalledOnce())
    expect(onStopRequested).toHaveBeenCalledOnce()
    expect(fixture.window.destroy).toHaveBeenCalledOnce()
    expect(fixture.tray.destroy).toHaveBeenCalledOnce()
  })

  it('keeps Web mode isolated from native creation and opens the local App', async () => {
    const fixture = createFixture()
    const resolution = await createOpenTrayDaemonPresenter({
      appAssetsDir: '/package/app',
      appLaunch: APP_LAUNCH,
      appServer: fixture.appServer,
      requestedHostMode: 'web',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested: vi.fn(),
      platform: 'darwin',
      driver: fixture.driver,
    })

    expect(resolution.effectiveHostMode).toBe('web')
    expect(fixture.webCalls).toHaveLength(1)
    expect(fixture.webCalls[0]?.runtime.appLaunch).toBeUndefined()
    expect(fixture.nativeCalls).toHaveLength(0)
    expect(fixture.opened).toEqual([fixture.appServer.url])
    await resolution.host.close()
  })

  it('selects Web on Linux before attempting native creation', async () => {
    const fixture = createFixture()
    const resolution = await createOpenTrayDaemonPresenter({
      appAssetsDir: '/package/app',
      appLaunch: APP_LAUNCH,
      appServer: fixture.appServer,
      requestedHostMode: 'native',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested: vi.fn(),
      platform: 'linux',
      driver: fixture.driver,
    })

    expect(resolution.effectiveHostMode).toBe('web')
    expect(fixture.nativeCalls).toHaveLength(0)
    expect(resolution.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'native-presentation-unavailable',
        stage: 'platform-selection',
      })
    )
    await resolution.host.close()
  })

  it('enables the Windows overlay window controls and semantic blur with the appMode contract', async () => {
    const fixture = createFixture()
    const resolution = await createOpenTrayDaemonPresenter({
      appAssetsDir: '/package/app',
      appLaunch: APP_LAUNCH,
      appServer: fixture.appServer,
      requestedHostMode: 'native',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested: vi.fn(),
      platform: 'win32',
      driver: fixture.driver,
    })

    expect(fixture.nativeCalls[0]?.window).toMatchObject({
      url: `${fixture.appServer.url}/?appMode=opentray-overlay`,
      windowControlsOverlay: true,
      style: {
        appMode: true,
        frameless: false,
        resizable: true,
        autoHide: false,
        background: { kind: 'semantic', token: 'blur', state: 'active' },
      },
    })
    await resolution.host.close()
  })

  it('keeps browser capability when the base Web tray is unavailable', async () => {
    const fixture = createFixture({ webFailure: true })
    const resolution = await createOpenTrayDaemonPresenter({
      appAssetsDir: '/package/app',
      appLaunch: APP_LAUNCH,
      appServer: fixture.appServer,
      requestedHostMode: 'web',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested: vi.fn(),
      platform: 'darwin',
      driver: fixture.driver,
    })

    expect(resolution.host.capabilities).toEqual({ browser: true, nativeWindow: false })
    expect(fixture.opened).toEqual([fixture.appServer.url])
    expect(resolution.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'web-tray-unavailable', stage: 'create-web-tray' })
    )
    await resolution.host.close()
  })

  it('cleans a failed native bootstrap and falls back to browser-capable Web truth', async () => {
    const fixture = createFixture({ showFailure: true })
    const resolution = await createOpenTrayDaemonPresenter({
      appAssetsDir: '/package/app',
      appLaunch: APP_LAUNCH,
      appServer: fixture.appServer,
      requestedHostMode: 'native',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested: vi.fn(),
      platform: 'darwin',
      driver: fixture.driver,
    })

    expect(resolution.effectiveHostMode).toBe('web')
    expect(resolution.host.capabilities).toEqual({ browser: true, nativeWindow: false })
    expect(fixture.webCalls).toHaveLength(1)
    expect(fixture.opened).toEqual([fixture.appServer.url])
    expect(fixture.events.slice(0, 3)).toEqual(['show', 'destroy:window', 'destroy:tray'])
    expect(resolution.diagnostics).toContainEqual({
      code: 'native-presentation-unavailable',
      stage: 'create-native-presenter',
      message: 'Native OpenTray presentation is unavailable; using the Web presenter.',
    })
    await resolution.host.close()
  })
})
