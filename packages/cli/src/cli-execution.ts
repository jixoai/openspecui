/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Execute checked CLI plans while preserving foreground project Server ownership.
 * 2. Apply the approved App admission matrix through daemon and Browser presentation ports.
 * 3. Keep export execution independent from daemon lifecycle.
 *
 * Original request (2026-07-29): "openspecui 启动当前项目其实是 openspecui serve 的缩写；start/stop/restart 针对 daemon。"
 */
import { resolve } from 'node:path'
import type { StartCommandPresenter } from './browser-start-command-presenter.js'
import type {
  CliCommandPlan,
  DaemonCommandPlan,
  ExportCommandPlan,
  ServeCommandPlan,
} from './cli-command.js'
import type { ExportOptions } from './export.js'
import type { CLIOptions, RunningServer } from './index.js'
import {
  planServePresentation,
  resolveAppPrompt,
  type ServePresentationPlan,
} from './serve-presentation-plan.js'

export type DaemonHostMode = 'native' | 'web'

export interface DaemonStatusEvidence {
  version: string
  hostMode: DaemonHostMode
  appUrl: string | null
}

export interface WorkspaceRegistration {
  projectDir: string
  backendUrl: string
  credential: string | null
}

export interface CliWorkspaceLease {
  close(): Promise<void>
}

/** Side-effecting daemon boundary consumed by the CLI execution owner. */
export interface CliDaemonPort {
  status(): Promise<DaemonStatusEvidence | null>
  start(requestedHostMode: 'web' | undefined): Promise<DaemonStatusEvidence>
  stop(): Promise<boolean>
  restart(requestedHostMode: 'web' | undefined): Promise<DaemonStatusEvidence>
  registerWorkspace(registration: WorkspaceRegistration): Promise<CliWorkspaceLease>
  activate(): Promise<void>
}

export interface CliExecutionDependencies {
  originalCwd: string
  inheritedAccessGateCredential: CLIOptions['accessGateCredential'] | null
  inheritedWebAssetsDir: string | null
  interactive: boolean
  startServer(options: CLIOptions): Promise<RunningServer>
  exportStaticSite(options: ExportOptions): Promise<void>
  daemon: CliDaemonPort
  browserPresenter: StartCommandPresenter
  promptForApp(): Promise<boolean>
  write(message: string): void
}

export interface ServeExecutionResult {
  kind: 'serve'
  server: RunningServer
  lease: CliWorkspaceLease | null
}

export type CliExecutionResult = ServeExecutionResult | { kind: 'complete' }

async function executeDaemonPlan(
  plan: DaemonCommandPlan,
  dependencies: CliExecutionDependencies
): Promise<CliExecutionResult> {
  if (plan.action === 'stop') {
    const stopped = await dependencies.daemon.stop()
    dependencies.write(
      stopped ? 'OpenSpecUI App daemon stopped.' : 'OpenSpecUI App daemon is not running.'
    )
    return { kind: 'complete' }
  }

  const status =
    plan.action === 'restart'
      ? await dependencies.daemon.restart(plan.requestedHostMode)
      : await dependencies.daemon.start(plan.requestedHostMode)
  dependencies.write(
    `OpenSpecUI App daemon ${plan.action === 'restart' ? 'restarted' : 'ready'} (${status.hostMode}, v${status.version}).`
  )
  return { kind: 'complete' }
}

async function executeExportPlan(
  plan: ExportCommandPlan,
  dependencies: CliExecutionDependencies
): Promise<CliExecutionResult> {
  const previewPort = plan.port ?? plan.previewPort
  const shouldOpen = plan.open === true || plan.port !== undefined
  await dependencies.exportStaticSite({
    projectDir: resolve(dependencies.originalCwd, plan.dir || '.'),
    outputDir: resolve(dependencies.originalCwd, plan.output),
    format: plan.format,
    basePath: plan.basePath,
    clean: plan.clean,
    open: shouldOpen,
    previewPort,
    previewHost: plan.previewHost,
    references: plan.references,
  })
  return { kind: 'complete' }
}

async function presentReadyServer(
  presentation: ServePresentationPlan,
  registration: WorkspaceRegistration,
  dependencies: CliExecutionDependencies
): Promise<CliWorkspaceLease | null> {
  if (presentation.kind === 'none') return null
  if (presentation.kind === 'prompt-for-app') throw new Error('App admission was not resolved.')
  if (presentation.kind === 'direct-web') {
    await dependencies.browserPresenter.present({
      surface: 'project-web',
      webBaseUrl: registration.backendUrl,
      credential: registration.credential,
    })
    return null
  }
  const lease = await dependencies.daemon.registerWorkspace(registration)
  try {
    await dependencies.daemon.activate()
    if (presentation.kind === 'app-and-direct-web') {
      await dependencies.browserPresenter.present({
        surface: 'project-web',
        webBaseUrl: registration.backendUrl,
        credential: registration.credential,
      })
    }
    return lease
  } catch (error) {
    await lease.close()
    throw error
  }
}

async function executeServePlan(
  plan: ServeCommandPlan,
  dependencies: CliExecutionDependencies
): Promise<CliExecutionResult> {
  const rawDir = plan.projectDir || plan.dir || '.'
  const projectDir = resolve(dependencies.originalCwd, rawDir)
  let daemonStatus: DaemonStatusEvidence | null = null
  let presentation: ServePresentationPlan = { kind: 'none' }
  if (plan.open) {
    daemonStatus = await dependencies.daemon.status()
    presentation = planServePresentation({
      open: plan.open,
      app: plan.app,
      web: plan.web,
      daemonRunning: daemonStatus !== null,
      interactive: dependencies.interactive,
    })
    if (presentation.kind === 'prompt-for-app') {
      presentation = resolveAppPrompt(await dependencies.promptForApp())
    }
    if (presentation.kind === 'app' && presentation.startDaemon) {
      daemonStatus = await dependencies.daemon.start(undefined)
    }
  }

  const appOrigin = daemonStatus?.appUrl ? new URL(daemonStatus.appUrl).origin : null
  let credential: string | null = null
  const server = await dependencies.startServer({
    projectDir,
    port: plan.port,
    open: false,
    auth: plan.auth ? true : undefined,
    password: plan.password,
    corsOrigins: appOrigin
      ? ['http://localhost:5173', 'http://localhost:3000', appOrigin]
      : undefined,
    accessGateCredential: dependencies.inheritedAccessGateCredential ?? undefined,
    webAssetsDir: dependencies.inheritedWebAssetsDir ?? undefined,
    onBrowserLaunchCredential: (value) => {
      credential = value
    },
  })

  dependencies.write(`Server running at ${server.url}`)
  if (!plan.open) return { kind: 'serve', server, lease: null }
  try {
    const lease = await presentReadyServer(
      presentation,
      { projectDir, backendUrl: server.url, credential },
      dependencies
    )
    return { kind: 'serve', server, lease }
  } catch (error) {
    await server.close()
    throw error
  }
}

/** Execute one parsed plan through explicit Server, daemon, Browser, and export owners. */
export async function executeCliCommand(
  plan: CliCommandPlan,
  dependencies: CliExecutionDependencies
): Promise<CliExecutionResult> {
  if (plan.kind === 'meta') return { kind: 'complete' }
  if (plan.kind === 'daemon') return executeDaemonPlan(plan, dependencies)
  if (plan.kind === 'export') return executeExportPlan(plan, dependencies)
  return executeServePlan(plan, dependencies)
}
