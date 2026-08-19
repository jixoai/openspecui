/**
 * Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
 * 1. Terminate one Core-owned child-process tree without crossing a reused Windows PID boundary.
 * 2. Expose exact Windows process-table ancestry and PID-identity termination for script reuse.
 * 3. Serialize Win32_Process snapshot reads behind one in-flight guard.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 * Original request (2026-08-19): "做好并发隔离" — concurrent WMI full-table reads starved runner settlement.
 */
import type { ChildProcess } from 'node:child_process'
import { execFile } from 'node:child_process'
import { win32 } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const WINDOWS_PROCESS_TABLE_MAX_BUFFER = 16 * 1024 * 1024

/** One process-table row returned by the Windows Win32_Process provider. */
export interface WindowsProcessRecord {
  readonly ExecutablePath: string | null
  readonly ParentProcessId: number
  readonly ProcessId: number
}

/**
 * In-flight serialization for Win32_Process reads. Multiple tests reading the full
 * process table concurrently delays WMI settlement past their bounded timeouts.
 */
let processTableReadInFlight: Promise<WindowsProcessRecord[]> | null = null

function hasChildExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

function normalizeWindowsExecutablePath(path: string): string {
  return win32.normalize(path).toLowerCase()
}

function isWindowsProcessRecord(value: unknown): value is WindowsProcessRecord {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Partial<WindowsProcessRecord>
  return (
    typeof row.ProcessId === 'number' &&
    typeof row.ParentProcessId === 'number' &&
    (typeof row.ExecutablePath === 'string' || row.ExecutablePath === null)
  )
}

/** Read the current Windows process table used for exact ancestry and root ownership checks. */
export async function readWindowsProcessTable(): Promise<WindowsProcessRecord[]> {
  // Serialize concurrent full-table reads: parallel WMI queries starve each other's settlement.
  if (processTableReadInFlight) return processTableReadInFlight
  processTableReadInFlight = (async (): Promise<WindowsProcessRecord[]> => {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,ExecutablePath | ConvertTo-Json -Compress',
      ],
      {
        encoding: 'utf8',
        maxBuffer: WINDOWS_PROCESS_TABLE_MAX_BUFFER,
        windowsHide: true,
      }
    )
    const json = stdout.trim()
    if (json.length === 0) return []
    const parsed: unknown = JSON.parse(json)
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows.filter(isWindowsProcessRecord)
  })()
  try {
    return await processTableReadInFlight
  } finally {
    processTableReadInFlight = null
  }
}

/** Resolve one root and all descendants from one immutable Windows process-table snapshot. */
export function resolveWindowsProcessTreePids(
  rootPid: number,
  rows: readonly WindowsProcessRecord[]
): number[] {
  const pending = [rootPid]
  const resolved = new Set(pending)
  while (pending.length > 0) {
    const parentPid = pending.shift()
    if (parentPid === undefined) break
    for (const row of rows) {
      if (row.ParentProcessId !== parentPid || resolved.has(row.ProcessId)) continue
      resolved.add(row.ProcessId)
      pending.push(row.ProcessId)
    }
  }
  return [...resolved]
}

/** Terminate a Windows tree only when the root PID still owns the expected executable. */
export async function terminateWindowsProcessTreeByIdentity(
  rootPid: number,
  expectedExecutablePath: string
): Promise<void> {
  const rows = await readWindowsProcessTable()
  const root = rows.find((row) => row.ProcessId === rootPid)
  if (!root) return

  const expectedExecutable = normalizeWindowsExecutablePath(expectedExecutablePath)
  const actualExecutable = root.ExecutablePath
    ? normalizeWindowsExecutablePath(root.ExecutablePath)
    : null
  if (actualExecutable !== expectedExecutable) {
    throw new Error(
      `Refusing to terminate PID ${rootPid}: expected ${expectedExecutable}, observed ${actualExecutable ?? 'no executable path'}.`
    )
  }

  try {
    await execFileAsync('taskkill.exe', ['/PID', String(rootPid), '/T', '/F'], {
      windowsHide: true,
    })
  } catch (error) {
    const currentRows = await readWindowsProcessTable()
    if (!currentRows.some((row) => row.ProcessId === rootPid)) return
    throw error
  }
}

async function terminateWindowsProcessTree(child: ChildProcess): Promise<void> {
  const rootPid = child.pid
  if (rootPid === undefined || hasChildExited(child)) return
  await terminateWindowsProcessTreeByIdentity(rootPid, child.spawnfile)
}

/** Request termination of one spawned child and every Windows descendant it owns. */
export async function terminateChildProcessTree(
  child: ChildProcess,
  signal: NodeJS.Signals = 'SIGTERM'
): Promise<void> {
  if (child.pid === undefined) {
    child.kill(signal)
    return
  }
  if (process.platform === 'win32') {
    await terminateWindowsProcessTree(child)
    return
  }
  if (hasChildExited(child)) return
  child.kill(signal)
}
