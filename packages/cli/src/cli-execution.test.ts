/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove production CLI execution preserves Server ownership and the presentation matrix.
 * 2. Prove no-open bypasses every daemon, prompt, registration, activation, and Browser effect.
 * 3. Prove daemon-only commands never start a project Server.
 *
 * Original request (2026-07-29): "--no-open 不询问、不启动 daemon、不投递 Workspace。"
 */
import { describe, expect, it, vi } from 'vitest'
import type { ProjectWebPresentationRequest } from './browser-start-command-presenter.js'
import type { ServeCommandPlan } from './cli-command.js'
import {
  executeCliCommand,
  type CliDaemonPort,
  type CliExecutionDependencies,
  type DaemonStatusEvidence,
} from './cli-execution.js'
import type { ExportOptions } from './export.js'
import type { CLIOptions, RunningServer } from './index.js'

const runningServer = {
  url: 'http://127.0.0.1:13100',
  port: 13100,
  preferredPort: 13100,
  close: vi.fn(async () => {}),
} satisfies RunningServer

function servePlan(overrides: Partial<ServeCommandPlan> = {}): ServeCommandPlan {
  return {
    kind: 'serve',
    projectDir: undefined,
    dir: undefined,
    port: 3100,
    open: true,
    app: false,
    web: false,
    auth: false,
    password: undefined,
    ...overrides,
  }
}

function createHarness(daemonStatus: DaemonStatusEvidence | null = null) {
  const events: string[] = []
  const requests: ProjectWebPresentationRequest[] = []
  const serverOptions: CLIOptions[] = []
  const exportOptions: ExportOptions[] = []
  const daemon: CliDaemonPort = {
    status: vi.fn(async () => {
      events.push('daemon.status')
      return daemonStatus
    }),
    start: vi.fn(async () => {
      events.push('daemon.start')
      return {
        version: '6.1.0',
        hostMode: 'native',
        openSpecSpawnMode: 'process',
        appUrl: 'http://127.0.0.1:14000',
      } satisfies DaemonStatusEvidence
    }),
    stop: vi.fn(async () => {
      events.push('daemon.stop')
      return true
    }),
    restart: vi.fn(async () => {
      events.push('daemon.restart')
      return {
        version: '6.1.0',
        hostMode: 'native',
        openSpecSpawnMode: 'process',
        appUrl: 'http://127.0.0.1:14000',
      } satisfies DaemonStatusEvidence
    }),
    registerWorkspace: vi.fn(async () => {
      events.push('daemon.register')
      return {
        close: vi.fn(async () => {
          events.push('lease.close')
        }),
      }
    }),
    activate: vi.fn(async () => {
      events.push('daemon.activate')
    }),
  }
  const dependencies: CliExecutionDependencies = {
    originalCwd: '/workspace',
    inheritedAccessGateCredential: null,
    inheritedWebAssetsDir: null,
    interactive: false,
    startServer: vi.fn(async (options) => {
      events.push('server.start')
      serverOptions.push(options)
      options.onBrowserLaunchCredential?.('private-credential')
      return runningServer
    }),
    exportStaticSite: vi.fn(async (options) => {
      exportOptions.push(options)
    }),
    daemon,
    browserPresenter: {
      present: vi.fn(async (request) => {
        events.push('browser.present')
        requests.push(request)
      }),
    },
    promptForApp: vi.fn(async () => {
      events.push('prompt')
      return true
    }),
    write: vi.fn(),
  }
  return { dependencies, events, requests, serverOptions, exportOptions }
}

describe('CLI execution owner', () => {
  it('short-circuits presentation before probing the daemon for --no-open', async () => {
    const harness = createHarness()
    await executeCliCommand(servePlan({ open: false }), harness.dependencies)

    expect(harness.events).toEqual(['server.start'])
    expect(harness.serverOptions[0]).toMatchObject({ open: false, projectDir: '/workspace' })
  })

  it('uses Direct Web for non-interactive serve without a daemon', async () => {
    const harness = createHarness()
    await executeCliCommand(servePlan(), harness.dependencies)

    expect(harness.events).toEqual(['daemon.status', 'server.start', 'browser.present'])
    expect(harness.requests).toEqual([
      {
        surface: 'project-web',
        webBaseUrl: runningServer.url,
        credential: 'private-credential',
      },
    ])
  })

  it('asks interactive admission and starts the daemon before registration', async () => {
    const harness = createHarness()
    harness.dependencies.interactive = true
    await executeCliCommand(servePlan(), harness.dependencies)

    expect(harness.events).toEqual([
      'daemon.status',
      'prompt',
      'daemon.start',
      'server.start',
      'daemon.register',
      'daemon.activate',
    ])
  })

  it('attaches and also opens Direct Web for --web when a daemon is present', async () => {
    const harness = createHarness({
      version: '6.1.0',
      hostMode: 'native',
      openSpecSpawnMode: 'process',
      appUrl: 'http://127.0.0.1:14000',
    })
    await executeCliCommand(servePlan({ web: true }), harness.dependencies)

    expect(harness.events).toEqual([
      'daemon.status',
      'server.start',
      'daemon.register',
      'daemon.activate',
      'browser.present',
    ])
  })

  it('executes daemon-only commands without starting a project Server', async () => {
    const harness = createHarness()
    await executeCliCommand(
      { kind: 'daemon', action: 'restart', requestedHostMode: 'web' },
      harness.dependencies
    )

    expect(harness.events).toEqual(['daemon.restart'])
  })
})
