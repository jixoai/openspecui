/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Load Dashboard Code Git snapshots independently from planning Summary and trends.
 * 2. Preserve backend-issued Code binding provenance and observable Git task lifecycle.
 * 3. Trigger explicit Git snapshot invalidation through a reactive stamp without broad Dashboard reloads.
 * 4. Propagate Projection Work cancellation into the Git subprocess tree.
 * 5. Hide Git identity-probe subprocess console windows (`windowsHide`) under the console-less
 *    Windows daemon.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Derived requirement (2026-07-25): P4.3 settles a cached refresh stamp before Dashboard Git refresh returns.
 * Original request (2026-07-31): "Code Git Snapshot，它非常慢，有时候甚至要十几秒"
 */
import {
  reactiveReadFile,
  writePhysicalReactiveFile,
  type DashboardGitSnapshot,
} from '@openspecui/core'
import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { buildDashboardGitSnapshot } from './dashboard-git-snapshot.js'

const execFileAsync = promisify(execFile)
const DASHBOARD_GIT_REFRESH_STAMP_NAME = 'openspecui-dashboard-git-refresh.stamp'

/** Observable Server task state for the independently scheduled Dashboard Git leaf. */
export interface DashboardGitTaskStatus {
  running: boolean
  inFlight: number
  lastStartedAt: number | null
  lastFinishedAt: number | null
  lastReason: string | null
  lastError: string | null
}

/** Dependencies for the Code Git Dashboard projection. */
export interface DashboardGitLoaderContext {
  projectDir: string
  codeBindingToken: string
}

const dashboardGitTaskStatusEmitter = new EventEmitter()
dashboardGitTaskStatusEmitter.setMaxListeners(200)

const dashboardGitTaskStatus: DashboardGitTaskStatus = {
  running: false,
  inFlight: 0,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastReason: null,
  lastError: null,
}

function emitDashboardGitTaskStatus(): void {
  dashboardGitTaskStatusEmitter.emit('change', getDashboardGitTaskStatus())
}

function beginDashboardGitTask(reason: string): void {
  dashboardGitTaskStatus.inFlight += 1
  dashboardGitTaskStatus.running = true
  dashboardGitTaskStatus.lastStartedAt = Date.now()
  dashboardGitTaskStatus.lastReason = reason
  dashboardGitTaskStatus.lastError = null
  emitDashboardGitTaskStatus()
}

function endDashboardGitTask(error: unknown): void {
  dashboardGitTaskStatus.inFlight = Math.max(0, dashboardGitTaskStatus.inFlight - 1)
  dashboardGitTaskStatus.running = dashboardGitTaskStatus.inFlight > 0
  dashboardGitTaskStatus.lastFinishedAt = Date.now()
  if (error) {
    dashboardGitTaskStatus.lastError = error instanceof Error ? error.message : String(error)
  }
  emitDashboardGitTaskStatus()
}

/** Return a value copy so consumers cannot mutate task state. */
export function getDashboardGitTaskStatus(): DashboardGitTaskStatus {
  return { ...dashboardGitTaskStatus }
}

/** Subscribe to Git leaf work without coupling it to Dashboard Summary. */
export function subscribeDashboardGitTaskStatus(
  listener: (status: DashboardGitTaskStatus) => void
): () => void {
  dashboardGitTaskStatusEmitter.on('change', listener)
  return () => {
    dashboardGitTaskStatusEmitter.off('change', listener)
  }
}

async function resolveGitMetadataDir(projectDir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--git-dir'], {
      cwd: projectDir,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8',
      windowsHide: true,
    })
    const gitDirRaw = stdout.trim()
    if (!gitDirRaw) return null
    const gitDirPath = resolve(projectDir, gitDirRaw)
    const gitDirStat = await stat(gitDirPath)
    return gitDirStat.isDirectory() ? gitDirPath : null
  } catch {
    return null
  }
}

/** Touch the explicit reactive Git refresh input when the user requests a current Code snapshot. */
export async function touchDashboardGitRefreshStamp(
  projectDir: string,
  reason: string
): Promise<{ skipped: boolean }> {
  const gitMetadataDir = await resolveGitMetadataDir(projectDir)
  if (!gitMetadataDir) return { skipped: true }
  await writePhysicalReactiveFile({
    rootPath: gitMetadataDir,
    relativePath: DASHBOARD_GIT_REFRESH_STAMP_NAME,
    content: `${Date.now()} ${reason}\n`,
  })
  return { skipped: false }
}

/** Load one Code Git snapshot and retain any failure as Git-region evidence only. */
export async function loadDashboardGitProjection(
  ctx: DashboardGitLoaderContext,
  reason = 'dashboard-git',
  signal?: AbortSignal
): Promise<DashboardGitSnapshot> {
  beginDashboardGitTask(reason)
  try {
    const gitMetadataDir = await resolveGitMetadataDir(ctx.projectDir)
    if (gitMetadataDir) {
      // Keep explicit refreshes and external stamp changes in the same reactive Work identity.
      await reactiveReadFile(join(gitMetadataDir, DASHBOARD_GIT_REFRESH_STAMP_NAME))
    }
    const snapshot = await buildDashboardGitSnapshot({
      projectDir: ctx.projectDir,
      bindingToken: ctx.codeBindingToken,
      signal,
    })
    endDashboardGitTask(null)
    return snapshot
  } catch (error) {
    endDashboardGitTask(error)
    throw error
  }
}
