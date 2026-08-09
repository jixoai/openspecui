/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Prove buffered subprocess phase timestamps distinguish eager result delivery from real exit.
 * 2. Prove Windows npm-style command shims preserve exact argv and descendant retirement independently
 *    from direct-child settlement.
 * 3. Preserve immediate, delayed, and pending-I/O non-zero exits plus stderr before eager JSON
 *    retirement.
 *
 * Original request (2026-07-31): "这些命令的执行，时间绝对不是七八秒那么久...请看一下代码，看能不能让trace更精确"
 * Original request (2026-08-06): "continue"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import { readWindowsProcessTable, resolveWindowsProcessTreePids } from './child-process-tree.js'
import { EAGER_JSON_EXIT_GRACE_MS, runBufferedCommand } from './spawn-safe.js'

const TSX_WINDOWS_SHIM = fileURLToPath(
  new URL('../../../node_modules/.bin/tsx.cmd', import.meta.url)
)
const WINDOWS_SPECIAL_ARGUMENTS = [
  '',
  'space separated',
  'a&b',
  '%PATH%',
  'a^b',
  'a"b',
  'C:\\space path\\',
  '(x)|y<z>',
]

async function createWindowsNodeCommandShim(root: string): Promise<string> {
  const commandShim = join(root, 'openspec.cmd')
  const entry = join(root, 'node_modules', 'openspec', 'bin', 'openspec.js')
  await mkdir(dirname(entry), { recursive: true })
  await writeFile(
    commandShim,
    [
      '@ECHO off',
      'IF EXIST "%~dp0\\node.exe" (',
      '  "%~dp0\\node.exe" "%~dp0\\node_modules\\openspec\\bin\\openspec.js" %*',
      ') ELSE (',
      '  node "%~dp0\\node_modules\\openspec\\bin\\openspec.js" %*',
      ')',
      '',
    ].join('\r\n')
  )
  await writeFile(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n')
  return commandShim
}

function blockEventLoop(durationMs: number): void {
  const signal = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(signal, 0, 0, durationMs)
}

describe('runBufferedCommand phase evidence', () => {
  it.runIf(process.platform === 'win32')(
    'preserves shell-sensitive argv through a real npm-style .cmd boundary',
    async () => {
      const root = await createTempDir()
      try {
        const command = await createWindowsNodeCommandShim(root)
        const result = await runBufferedCommand({
          command,
          args: WINDOWS_SPECIAL_ARGUMENTS,
          cwd: root,
          env: process.env,
        })

        expect(result.exitCode, result.stderr).toBe(0)
        expect(JSON.parse(result.stdout)).toEqual(WINDOWS_SPECIAL_ARGUMENTS)
      } finally {
        await cleanupTempDir(root)
      }
    }
  )

  it.runIf(process.platform === 'win32')(
    'retires every recorded tsx.cmd descendant after a buffered timeout',
    async () => {
      let rootPid = -1
      let processTableAtReady: Promise<Awaited<ReturnType<typeof readWindowsProcessTable>>> | null =
        null
      const result = await runBufferedCommand({
        command: TSX_WINDOWS_SHIM,
        args: [
          '-e',
          "process.stdout.write('ready'); setTimeout(() => process.exit(0), 5_000); setInterval(() => {}, 1_000)",
        ],
        cwd: process.cwd(),
        env: process.env,
        timeoutMs: 1_500,
        onPhase: ({ phase, pid }) => {
          if (phase === 'spawn-returned' && pid !== undefined) rootPid = pid
          if (phase === 'first-stdout-observed') processTableAtReady = readWindowsProcessTable()
        },
      })

      expect(result.timedOut).toBe(true)
      const readyRows = await processTableAtReady
      expect(readyRows).not.toBeNull()
      if (!readyRows) return
      const trackedPids = resolveWindowsProcessTreePids(rootPid, readyRows)
      expect(trackedPids.length).toBeGreaterThan(1)
      const remainingRows = await readWindowsProcessTable()
      expect(
        trackedPids.filter((pid) => remainingRows.some((row) => row.ProcessId === pid))
      ).toEqual([])
    },
    20_000
  )

  it('does not report eager JSON delivery as the child process exit', async () => {
    const phaseNames: string[] = []
    const result = await runBufferedCommand({
      command: process.execPath,
      args: [
        '-e',
        'process.stdout.write(JSON.stringify({ ok: true })); setTimeout(() => {}, 1_000)',
      ],
      cwd: process.cwd(),
      env: process.env,
      eagerResolveJson: true,
      onPhase: ({ phase }) => phaseNames.push(phase),
    })

    expect(result).toMatchObject({
      stdout: '{"ok":true}',
      exitCode: 0,
      phases: {
        eagerResolved: true,
        resultReason: 'eager-json',
        exitAt: 0,
        closeAt: 0,
      },
    })
    expect(result.phases?.jsonCompleteAt).toBeGreaterThanOrEqual(
      result.phases?.firstStdoutAt ?? Number.POSITIVE_INFINITY
    )
    expect(phaseNames).toEqual(
      expect.arrayContaining([
        'spawn-called',
        'spawn-returned',
        'spawn-observed',
        'first-stdout-observed',
        'json-complete-observed',
        'termination-requested',
        'result-resolved',
      ])
    )
    expect(phaseNames).not.toContain('exit-observed')
    expect(phaseNames).not.toContain('close-observed')
  }, 20_000)

  it('preserves immediate JSON failure evidence instead of reporting eager success', async () => {
    const result = await runBufferedCommand({
      command: process.execPath,
      args: [
        '-e',
        [
          'process.stdout.write(JSON.stringify({ ok: false }))',
          "process.stderr.write('fixture failure')",
          'process.exitCode = 7',
        ].join(';'),
      ],
      cwd: process.cwd(),
      env: process.env,
      eagerResolveJson: true,
    })

    expect(result).toMatchObject({
      stdout: '{"ok":false}',
      stderr: 'fixture failure',
      exitCode: 7,
      phases: {
        eagerResolved: false,
        resultReason: 'close',
      },
    })
  }, 20_000)

  it('preserves delayed JSON failure evidence before eager retirement', async () => {
    const result = await runBufferedCommand({
      command: process.execPath,
      args: [
        '-e',
        [
          'process.stdout.write(JSON.stringify({ ok: false }))',
          "setTimeout(() => { process.stderr.write('delayed fixture failure'); process.exitCode = 7 }, 40)",
        ].join(';'),
      ],
      cwd: process.cwd(),
      env: process.env,
      eagerResolveJson: true,
    })

    expect(result).toMatchObject({
      stdout: '{"ok":false}',
      stderr: 'delayed fixture failure',
      exitCode: 7,
      phases: {
        eagerResolved: false,
        resultReason: 'close',
      },
    })
  }, 20_000)

  it('drains pending child exit I/O before eager retirement', async () => {
    const result = await runBufferedCommand({
      command: process.execPath,
      args: [
        '-e',
        [
          'process.stdout.write(JSON.stringify({ ok: false }))',
          "setTimeout(() => { process.stderr.write('blocked fixture failure'); process.exitCode = 7 }, 40)",
        ].join(';'),
      ],
      cwd: process.cwd(),
      env: process.env,
      eagerResolveJson: true,
      onPhase: ({ phase }) => {
        if (phase !== 'json-complete-observed') return
        setTimeout(() => blockEventLoop(EAGER_JSON_EXIT_GRACE_MS + 50), 5)
      },
    })

    expect(result).toMatchObject({
      stdout: '{"ok":false}',
      stderr: 'blocked fixture failure',
      exitCode: 7,
      phases: {
        eagerResolved: false,
        resultReason: 'close',
      },
    })
  }, 20_000)

  it('reports real exit and close before resolving a non-eager result', async () => {
    const phaseNames: string[] = []
    const result = await runBufferedCommand({
      command: process.execPath,
      args: ['-e', "process.stdout.write('done')"],
      cwd: process.cwd(),
      env: process.env,
      onPhase: ({ phase }) => phaseNames.push(phase),
    })

    expect(result).toMatchObject({
      stdout: 'done',
      exitCode: 0,
      phases: {
        eagerResolved: false,
        resultReason: 'close',
      },
    })
    expect(result.phases?.exitAt).toBeGreaterThan(0)
    expect(result.phases?.closeAt).toBeGreaterThanOrEqual(result.phases?.exitAt ?? Infinity)
    expect(phaseNames.indexOf('exit-observed')).toBeLessThan(phaseNames.indexOf('close-observed'))
    expect(phaseNames.indexOf('close-observed')).toBeLessThan(phaseNames.indexOf('result-resolved'))
  }, 20_000)
})
