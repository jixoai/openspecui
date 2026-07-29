/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Prove native bootstrap and retained activation through the production presenter factory.
 * 2. Prove hide-versus-destroy semantics and exact final teardown order.
 * 3. Prove Web import isolation, platform selection, and native fallback truth.
 * 4. Prove native page authority is bound to the exact loopback App origin.
 *
 * Compromise: these four assertion groups share one checked driver fixture because splitting the
 * fixture would duplicate the same retained-window state-machine seam and weaken mutation evidence.
 *
 * Original request (2026-07-29): "多次执行 openspecui --app 只是在激活同一个 daemon。"
 */
import { describe, expect, it, vi } from 'vitest'
import type { LocalAppServer } from './local-app-server.js'
import {
  createOpenTrayDaemonPresenter,
  type OpenTrayPresenterDriver,
} from './opentray-daemon-presenter.js'

type NativeCreateOptions = Parameters<OpenTrayPresenterDriver['createNative']>[0]
type WebCreateOptions = Parameters<OpenTrayPresenterDriver['createWebTray']>[0]

function createFixture(
  options: { nativeFailure?: boolean; showFailure?: boolean; webFailure?: boolean } = {}
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
    isVisible: vi.fn(async () => visible),
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
    expect(fixture.nativeCalls[0]).toEqual(
      expect.objectContaining({
        runtime: expect.objectContaining({
          appId: 'com.jixoai.openspecui',
          appName: 'OpenSpecUI',
          packageVersion: '6.1.0',
        }),
        window: expect.objectContaining({
          url: fixture.appServer.url,
          width: 1280,
          height: 840,
          nativeWindowApi: true,
          windowControlsOverlay: true,
          nativeApiPolicy: {
            defaultSrc: ["'none'"],
            window: ['http://127.0.0.1:43121'],
          },
          style: {
            appMode: true,
            frameless: false,
            resizable: true,
            autoHide: false,
          },
        }),
      })
    )
    expect(JSON.stringify(fixture.nativeCalls[0])).not.toContain('"*"')
    expect(fixture.window.show).toHaveBeenCalledOnce()

    fixture.events.length = 0
    await resolution.host.activate()
    await resolution.host.activate()
    expect(fixture.events).toEqual(['toVisible', 'focus', 'toVisible', 'focus'])
    expect(fixture.window.show).toHaveBeenCalledOnce()
  })

  it('hides the retained window without destroying it and tears down in owner order', async () => {
    const fixture = createFixture()
    const { host } = await createOpenTrayDaemonPresenter({
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
      'off:reopen',
      'destroy:window',
      'destroy:tray',
      'close:app-server',
    ])
  })

  it('keeps Web mode isolated from native creation and opens the local App', async () => {
    const fixture = createFixture()
    const resolution = await createOpenTrayDaemonPresenter({
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
    expect(fixture.nativeCalls).toHaveLength(0)
    expect(fixture.opened).toEqual([fixture.appServer.url])
    await resolution.host.close()
  })

  it('selects Web on Linux before attempting native creation', async () => {
    const fixture = createFixture()
    const resolution = await createOpenTrayDaemonPresenter({
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

  it('keeps the Windows native frame while preserving the same appMode contract', async () => {
    const fixture = createFixture()
    const resolution = await createOpenTrayDaemonPresenter({
      appServer: fixture.appServer,
      requestedHostMode: 'native',
      version: '6.1.0',
      openExternalUrl: fixture.openExternalUrl,
      onStopRequested: vi.fn(),
      platform: 'win32',
      driver: fixture.driver,
    })

    expect(fixture.nativeCalls[0]?.window).toMatchObject({
      windowControlsOverlay: false,
      style: { appMode: true, frameless: false, resizable: true, autoHide: false },
    })
    await resolution.host.close()
  })

  it('keeps browser capability when the base Web tray is unavailable', async () => {
    const fixture = createFixture({ webFailure: true })
    const resolution = await createOpenTrayDaemonPresenter({
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
