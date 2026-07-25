/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Cross real CLI private Direct/App launch and the public Project Web shell.
 * 2. Cross App locator binding, iframe bootstrap, and child-style fragment consumption/removal.
 * 3. Terminate after protected tRPC HTTP, tRPC subscription, and PTY auth-first succeed.
 * 4. Supply a physical minimal Web root without relying on generated workspace assets.
 *
 * Original request (2026-07-24): "Add the strongest feasible terminating gated Direct/App fixture."
 * Delivery correction (2026-07-25): the clean-CI fixture must own its physical Web assets.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NodeWebSocket from 'ws'
import { consumeHostedLaunchUrl } from '../../app/src/lib/bootstrap'
import { probeHostedBackend } from '../../app/src/lib/reachability'
import {
  applyHostedLaunchRequest,
  buildHostedEmbeddedUiUrl,
  createEmptyHostedShellState,
} from '../../app/src/lib/shell-state'
import { buildDirectWebLaunchUrl, buildHostedAppLaunchUrl } from '../../cli/src/hosted-app'
import { startServer, type RunningServer } from '../../cli/src/index'
import { findAvailablePort } from './port-utils'

vi.mock(import('../../web/src/lib/terminal-bell-sound-engine'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    TerminalBellSoundEngine: class extends actual.TerminalBellSoundEngine {
      override init(): void {}
    },
  }
})

const servers: RunningServer[] = []
const sockets: NodeWebSocket[] = []
const tempDirs: string[] = []
let nextPreferredPort = 36_100

interface FixtureBrowserWindow {
  location: URL
  history: {
    state: unknown
    replaceState(data: unknown, unused: string, url?: string | URL | null): void
    pushState(data: unknown, unused: string, url?: string | URL | null): void
  }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void
  __OPENSPEC_STATIC_MODE__?: boolean
}

class ObservedWebSocket extends NodeWebSocket {
  static instances: ObservedWebSocket[] = []
  readonly received: unknown[] = []
  readonly sent: unknown[] = []

  constructor(address: string | URL) {
    super(address)
    ObservedWebSocket.instances.push(this)
    sockets.push(this)
    this.on('message', (data) => {
      try {
        this.received.push(JSON.parse(data.toString()) as unknown)
      } catch {
        // Non-JSON frames are irrelevant to the admission fixture.
      }
    })
    const nativeSend = this.send.bind(this)
    Object.defineProperty(this, 'send', {
      value: (data: unknown, ...rest: unknown[]) => {
        try {
          this.sent.push(JSON.parse(String(data)) as unknown)
        } catch {
          // Non-JSON frames are irrelevant to the admission fixture.
        }
        return Reflect.apply(nativeSend, this, [data, ...rest])
      },
    })
  }
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate()
  await Promise.all(servers.splice(0).map((server) => server.close()))
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  ObservedWebSocket.instances = []
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.resetModules()
})

function installBrowserWindow(initialUrl: string): FixtureBrowserWindow {
  const storage = new Map<string, string>()
  const browserWindow: FixtureBrowserWindow = {
    location: new URL(initialUrl),
    history: {
      state: null,
      replaceState(data, _unused, url) {
        browserWindow.history.state = data
        if (url !== undefined && url !== null) {
          browserWindow.location = new URL(url, browserWindow.location)
        }
      },
      pushState(data, unused, url) {
        browserWindow.history.replaceState(data, unused, url)
      },
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  vi.stubGlobal('window', browserWindow)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    clear: () => {
      storage.clear()
    },
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size
    },
  } satisfies Storage)
  return browserWindow
}

describe('gated Direct/App Project Web product chain', () => {
  it('terminates after private launch, public shell, HTTP, subscription, and PTY auth-first', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-gated-product-chain-'))
    tempDirs.push(projectDir)
    const webAssetsDir = join(projectDir, 'web-assets')
    await mkdir(webAssetsDir)
    await writeFile(
      join(webAssetsDir, 'index.html'),
      '<!doctype html><html><body data-product-chain-shell></body></html>',
      'utf8'
    )
    const port = await findAvailablePort(nextPreferredPort, 100)
    nextPreferredPort = port + 1
    let launchCredential: string | null = null
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const server = await startServer({
      projectDir,
      port,
      enableWatcher: false,
      password: 'product-chain-secret',
      webAssetsDir,
      onBrowserLaunchCredential: (credential) => {
        launchCredential = credential
      },
    })
    servers.push(server)
    if (!launchCredential) throw new Error('CLI did not deliver its private launch credential.')

    const directLaunch = new URL(
      buildDirectWebLaunchUrl({ baseUrl: server.url, credential: launchCredential })
    )
    const browserWindow = installBrowserWindow(directLaunch.toString())
    const appLaunch = buildHostedAppLaunchUrl({
      baseUrl: 'http://app.openspecui.test',
      apiBaseUrl: server.url,
      credential: launchCredential,
    })
    expect(new URLSearchParams(directLaunch.hash.slice(1)).get('credential')).toBe(launchCredential)

    const publicShell = await fetch(server.url)
    const rejectedHealth = await fetch(`${server.url}/api/health`)
    expect(publicShell.status).toBe(200)
    expect(await publicShell.text()).toContain('data-product-chain-shell')
    expect(rejectedHealth.status).toBe(401)

    const directCredentialOwner = await import('../../web/src/lib/access-gate-credential')
    expect(directCredentialOwner.consumeAccessGateLaunchCredential()).toBe(launchCredential)
    expect(browserWindow.location.hash).toBe('')
    const directHealth = await directCredentialOwner.accessGateFetch(`${server.url}/api/health`)
    expect(directHealth.status).toBe(200)

    const appLaunchResult = consumeHostedLaunchUrl(appLaunch)
    if (!appLaunchResult.request) throw new Error('App did not accept the CLI launch locator.')
    const reachability = await probeHostedBackend(appLaunchResult.request.apiBaseUrl)
    expect(reachability.reachability).toBe('online')
    if (!reachability.health) throw new Error('App did not receive protected backend health.')

    const shellState = applyHostedLaunchRequest(
      createEmptyHostedShellState(),
      appLaunchResult.request,
      { now: 1, sessionId: 'product-chain' }
    )
    const tab = shellState.tabs[0]
    if (!tab) throw new Error('App did not create the matching Project Web tab.')
    const iframeUrl = new URL(buildHostedEmbeddedUiUrl(tab, reachability.health.embeddedUiUrl))
    expect(new URLSearchParams(iframeUrl.hash.slice(1)).get('credential')).toBe(launchCredential)

    vi.resetModules()
    browserWindow.location = iframeUrl
    const credentialOwner = await import('../../web/src/lib/access-gate-credential')
    expect(credentialOwner.consumeAccessGateLaunchCredential()).toBe(launchCredential)
    expect(browserWindow.location.hash).toBe('')

    vi.stubGlobal('WebSocket', ObservedWebSocket as unknown as typeof WebSocket)
    const { trpcClient } = await import('../../web/src/lib/trpc')
    const status = await trpcClient.system.status.query()
    expect(status.projectDir).toBe(projectDir)

    const subscriptionValue = await new Promise<unknown>((resolve, reject) => {
      const subscription = trpcClient.kv.subscribe.subscribe(
        { key: 'product-chain' },
        {
          onData(value) {
            subscription.unsubscribe()
            resolve(value)
          },
          onError: reject,
        }
      )
    })
    expect(subscriptionValue).toBeNull()

    const { terminalController } = await import('../../web/src/lib/terminal-controller')
    const unsubscribeTerminal = terminalController.subscribe(() => undefined)
    await vi.waitFor(
      () => {
        const ptySocket = ObservedWebSocket.instances.find((socket) =>
          socket.url.endsWith('/ws/pty')
        )
        if (!ptySocket) throw new Error('TerminalController did not open the PTY transport.')
        expect(ptySocket.sent.slice(0, 2)).toEqual([
          { type: 'auth', credential: launchCredential },
          { type: 'list' },
        ])
        expect(ptySocket.received).toContainEqual({ type: 'list', sessions: [] })
      },
      { timeout: 5_000 }
    )
    unsubscribeTerminal()
  }, 15_000)
})
