/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Prove production CLI execution preserves Server ownership and the presentation matrix.
 * 2. Prove no-open bypasses every daemon, prompt, registration, activation, and Browser effect.
 * 3. Prove daemon-only commands never start a project Server.
 * 4. Prove the preference fallback, implicit-default warning, and Radio cancel/write flow.
 *
 * Original request (2026-07-29): "--no-open 不询问、不启动 daemon、不投递 Workspace。"
 * Original request (2026-08-01): "全局偏好 + 交互式 Radio；非 tty 无偏好默认 web + 警告。"
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
import type { ServeMode } from './serve-presentation-plan.js'

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

interface HarnessOptions {
  daemonStatus?: DaemonStatusEvidence | null
  preference?: ServeMode
  promptResult?: ServeMode | null
}

function createHarness(options: HarnessOptions = {}) {
  const events: string[] = []
  const requests: ProjectWebPresentationRequest[] = []
  const serverOptions: CLIOptions[] = []
  const exportOptions: ExportOptions[] = []
  const writes: string[] = []
  const preferenceWrites: ServeMode[] = []
  const daemon: CliDaemonPort = {
    status: vi.fn(async () => {
      events.push('daemon.status')
      return options.daemonStatus ?? null
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
    startServer: vi.fn(async (serverOption) => {
      events.push('server.start')
      serverOptions.push(serverOption)
      serverOption.onBrowserLaunchCredential?.('private-credential')
      return runningServer
    }),
    exportStaticSite: vi.fn(async (exportOption) => {
      exportOptions.push(exportOption)
    }),
    daemon,
    browserPresenter: {
      present: vi.fn(async (request) => {
        events.push('browser.present')
        requests.push(request)
      }),
    },
    servePreferences: {
      read: vi.fn(async () => {
        events.push('preference.read')
        return options.preference
      }),
      write: vi.fn(async (mode: ServeMode) => {
        events.push('preference.write')
        preferenceWrites.push(mode)
      }),
    },
    promptForServeMode: vi.fn(async () => {
      events.push('prompt')
      return Object.prototype.hasOwnProperty.call(options, 'promptResult')
        ? (options.promptResult as ServeMode | null)
        : 'app'
    }),
    write: vi.fn((message: string) => {
      writes.push(message)
    }),
  }
  return { dependencies, events, requests, serverOptions, exportOptions, writes, preferenceWrites }
}

/**
 * Extract only the implicit-default warning write (the production owner also writes
 * "Server running at …", so filter by the known warning marker).
 */
function implicitWarningWrites(writes: string[]): string[] {
  return writes.filter((message) => message.includes('--app') && message.includes('--web'))
}

describe('CLI execution owner', () => {
  it('short-circuits presentation before probing the daemon for --no-open', async () => {
    const harness = createHarness()
    await executeCliCommand(servePlan({ open: false }), harness.dependencies)

    expect(harness.events).toEqual(['server.start'])
    expect(harness.serverOptions[0]).toMatchObject({ open: false, projectDir: '/workspace' })
  })

  it('warns and uses Direct Web when non-interactive with no preference', async () => {
    const harness = createHarness()
    await executeCliCommand(servePlan(), harness.dependencies)

    expect(harness.events).toEqual([
      'daemon.status',
      'preference.read',
      'server.start',
      'browser.present',
    ])
    expect(implicitWarningWrites(harness.writes)).toHaveLength(1)
    expect(implicitWarningWrites(harness.writes)[0]).toContain('--app')
    expect(implicitWarningWrites(harness.writes)[0]).toContain('--web')
  })

  it('starts the daemon for a non-interactive preference of app without warning', async () => {
    const harness = createHarness({ preference: 'app' })
    await executeCliCommand(servePlan(), harness.dependencies)

    expect(harness.events).toEqual([
      'daemon.status',
      'preference.read',
      'daemon.start',
      'server.start',
      'daemon.register',
      'daemon.activate',
    ])
    expect(implicitWarningWrites(harness.writes)).toEqual([])
  })

  it('uses Direct Web for a non-interactive preference of web without warning', async () => {
    const harness = createHarness({ preference: 'web' })
    await executeCliCommand(servePlan(), harness.dependencies)

    expect(harness.events).toEqual([
      'daemon.status',
      'preference.read',
      'server.start',
      'browser.present',
    ])
    expect(implicitWarningWrites(harness.writes)).toEqual([])
  })

  it('reads the preference, prompts, and writes the selection for interactive serves', async () => {
    const harness = createHarness({ preference: 'web', promptResult: 'app' })
    harness.dependencies.interactive = true
    await executeCliCommand(servePlan(), harness.dependencies)

    expect(harness.events).toEqual([
      'daemon.status',
      'preference.read',
      'prompt',
      'preference.write',
      'daemon.start',
      'server.start',
      'daemon.register',
      'daemon.activate',
    ])
    expect(harness.preferenceWrites).toEqual(['app'])
  })

  it('aborts when the interactive Radio is cancelled', async () => {
    const harness = createHarness({ promptResult: null })
    harness.dependencies.interactive = true
    await expect(executeCliCommand(servePlan(), harness.dependencies)).rejects.toThrow(
      'Serve mode selection cancelled.'
    )

    expect(harness.events).toEqual(['daemon.status', 'preference.read', 'prompt'])
    // No daemon started, no preference written, no Server started.
    expect(harness.preferenceWrites).toEqual([])
    expect(harness.serverOptions).toEqual([])
  })

  it('attaches and also opens Direct Web for --web when a daemon is present', async () => {
    const harness = createHarness({
      daemonStatus: {
        version: '6.1.0',
        hostMode: 'native',
        openSpecSpawnMode: 'process',
        appUrl: 'http://127.0.0.1:14000',
      },
    })
    await executeCliCommand(servePlan({ web: true }), harness.dependencies)

    expect(harness.events).toEqual([
      'daemon.status',
      'preference.read',
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
