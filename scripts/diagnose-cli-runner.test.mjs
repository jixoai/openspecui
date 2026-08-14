/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Prove the plain-Node Windows diagnostic resolves an npm-style CLI shim and retires its timed-out tree.
 * 2. Distinguish a complete diagnostic report from an early child-process failure before JSON parsing.
 * 3. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 * 4. Compare `where.exe` evidence through canonical paths because hosted runners mix 8.3 short
 *    forms (RUNNER~1) with long forms in TEMP-derived fixture roots.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readWindowsProcessTable } from '../packages/core/src/child-process-tree.js'

const DIAGNOSTIC_SCRIPT = fileURLToPath(new URL('./diagnose-cli-runner.mjs', import.meta.url))

function canonicalWindowsPath(value) {
  try {
    return realpathSync.native(value).toLowerCase()
  } catch {
    return value.toLowerCase()
  }
}

describe.runIf(process.platform === 'win32')('CLI runner diagnostic portability', () => {
  it('resolves openspec.cmd without cmd.exe argv parsing and retires every timed-out descendant', async () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'openspecui-cli-diagnostic-'))
    try {
      const shim = join(fixtureRoot, 'openspec.cmd')
      const entry = join(fixtureRoot, 'node_modules', 'openspec', 'bin', 'openspec.js')
      const pidFile = join(fixtureRoot, 'pids.txt')
      mkdirSync(dirname(entry), { recursive: true })
      writeFileSync(
        shim,
        '@ECHO off\r\n"%~dp0\\node.exe" "%~dp0\\node_modules\\openspec\\bin\\openspec.js" %*\r\n'
      )
      writeFileSync(
        entry,
        [
          "const { spawn } = require('node:child_process')",
          "const { appendFileSync } = require('node:fs')",
          "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], { windowsHide: true })",
          'appendFileSync(process.env.OPENSPECUI_DIAGNOSTIC_PID_FILE, `${process.pid}\\n${child.pid}\\n`)',
          'setInterval(() => {}, 1_000)',
        ].join(';')
      )

      const diagnosticEnv = {
        ...process.env,
        OPENSPECUI_CLI_PROBE_TIMEOUT_MS: '300',
        OPENSPECUI_DIAGNOSTIC_PID_FILE: pidFile,
        Path: `${fixtureRoot};${process.env.Path ?? process.env.PATH ?? ''}`,
      }
      delete diagnosticEnv.PATH
      const whereResult = spawnSync('where.exe', ['openspec'], {
        encoding: 'utf8',
        env: diagnosticEnv,
        windowsHide: true,
      })
      const whereCandidates = whereResult.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      expect(
        whereCandidates.some((line) => canonicalWindowsPath(line) === canonicalWindowsPath(shim)),
        `${whereResult.stderr}\ncandidates: ${whereCandidates.join('\n')}`
      ).toBe(true)
      const result = spawnSync(process.execPath, [DIAGNOSTIC_SCRIPT, '--no-network', '--json'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: diagnosticEnv,
        timeout: 30_000,
        windowsHide: true,
      })

      const processEvidence = JSON.stringify(
        {
          error: result.error?.message,
          signal: result.signal,
          status: result.status,
          stderr: result.stderr,
          stdout: result.stdout,
        },
        null,
        2
      )
      expect(result.error, processEvidence).toBeUndefined()
      expect(result.signal, processEvidence).toBeNull()
      expect(result.status, result.stderr).toBe(1)
      expect(result.stdout, processEvidence).not.toBe('')
      const report = JSON.parse(result.stdout)
      expect(report.attempts).toEqual(
        expect.arrayContaining([expect.objectContaining({ command: 'openspec', timedOut: true })])
      )
      expect(existsSync(pidFile), JSON.stringify(report, null, 2)).toBe(true)
      const trackedPids = readFileSync(pidFile, 'utf8').trim().split(/\r?\n/).map(Number)
      expect(trackedPids.length).toBeGreaterThanOrEqual(2)
      const rows = await readWindowsProcessTable()
      expect(trackedPids.filter((pid) => rows.some((row) => row.ProcessId === pid))).toEqual([])
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  }, 35_000)
})
