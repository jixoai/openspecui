#!/usr/bin/env node

/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Parse one production yargs command plan and dispatch serve, daemon, export, or meta execution.
 * 2. Keep each foreground serve process as the sole owner of its project Server and shutdown.
 * 3. Bootstrap the detached App daemon and consume only its explicit managed-directory restoration handoff.
 *
 * Original request (2026-07-15): "新增一个 --auth 或者 --password。"
 * Delivery correction (2026-07-24): one resolved credential must reach Server and Project Web.
 * Delivery correction (2026-07-26): process children consume the parent's resolved Web asset root.
 * Owner correction (2026-07-29): bare openspecui is serve; start/stop/restart own only the App daemon.
 * Owner correction (2026-07-30): native appMode cold launch must re-enter the public `start` lifecycle.
 * Owner lifecycle decision (2026-07-30): daemon restart restores the managed running directory set.
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promptForAppAdmission } from './app-admission-prompt.js'
import { getCliArgs } from './argv.js'
import { createBrowserStartCommandPresenter } from './browser-start-command-presenter.js'
import { parseCliCommand } from './cli-command.js'
import { executeCliCommand } from './cli-execution.js'
import { createDaemonController } from './daemon-controller.js'
import {
  consumeDaemonBootstrap,
  consumeDaemonRestoreProjects,
  runDaemonProcess,
} from './daemon-process.js'
import { exportStaticSite } from './export.js'
import { startServer } from './index.js'
import { readCliPackageVersion } from './package-version.js'
import { buildStartupBanner } from './startup-banner.js'
import {
  consumeWorktreeProcessAccessGateCredential,
  consumeWorktreeProcessWebAssetsDir,
} from './worktree-server-worker.js'

const entryPath = fileURLToPath(import.meta.url)
const runtimeDir = dirname(entryPath)

async function main(): Promise<void> {
  const inheritedAccessGateCredential = consumeWorktreeProcessAccessGateCredential(process.env)
  const inheritedWebAssetsDir = consumeWorktreeProcessWebAssetsDir(process.env)
  const daemonHostMode = consumeDaemonBootstrap(process.env)
  if (daemonHostMode) {
    await runDaemonProcess({
      entryPath,
      hostMode: daemonHostMode,
      runtimeDir,
      restoreProjectDirs: consumeDaemonRestoreProjects(process.env),
      startProjectServer: startServer,
    })
    return
  }

  const version = readCliPackageVersion(runtimeDir)
  const originalCwd = process.env.INIT_CWD || process.cwd()
  const plan = await parseCliCommand(getCliArgs(process.argv), { version })
  if (plan.kind === 'serve') {
    const projectDir = resolve(originalCwd, plan.projectDir || plan.dir || '.')
    console.log(buildStartupBanner({ projectDir, version }))
    console.log('')
  }

  const daemon = createDaemonController({
    version,
    entryPath: fileURLToPath(import.meta.url),
  })
  const result = await executeCliCommand(plan, {
    originalCwd,
    inheritedAccessGateCredential,
    inheritedWebAssetsDir,
    interactive: process.stdin.isTTY === true && process.stdout.isTTY === true,
    startServer,
    exportStaticSite,
    daemon,
    browserPresenter: createBrowserStartCommandPresenter(async (target) => {
      const open = await import('open')
      await open.default(target)
    }),
    promptForApp: () => promptForAppAdmission({ input: process.stdin, output: process.stdout }),
    write: (message) => console.log(message),
  })

  if (result.kind !== 'serve') return
  if (result.server.port !== result.server.preferredPort) {
    console.log(
      `Port ${result.server.preferredPort} is in use, using ${result.server.port} instead.`
    )
  }
  console.log('')
  console.log('Press Ctrl+C to stop the server')

  let closing = false
  const shutdown = async () => {
    if (closing) return
    closing = true
    await result.lease?.close()
    await result.server.close()
  }
  process.once('SIGINT', () => void shutdown())
  process.once('SIGTERM', () => void shutdown())
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Fatal OpenSpecUI error.')
  process.exitCode = 1
})
