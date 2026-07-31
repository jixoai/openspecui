/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove buffered subprocess phase timestamps distinguish eager result delivery from real exit.
 * 2. Prove JSON response readiness remains observable independently from child-process settlement.
 * 3. Preserve a naturally arriving non-zero exit and stderr before eager JSON retirement.
 *
 * Original request (2026-07-31): "这些命令的执行，时间绝对不是七八秒那么久...请看一下代码，看能不能让trace更精确"
 */
import { describe, expect, it } from 'vitest'
import { runBufferedCommand } from './spawn-safe.js'

describe('runBufferedCommand phase evidence', () => {
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
