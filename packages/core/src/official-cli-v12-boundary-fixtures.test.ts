/**
 * Orthogonal intents (created 2026-09-03 Asia/Shanghai):
 * 1. Prove the executable identity of both pinned fixture lines: the v12 helper's
 *    1.12.0 bin and the retained v11 helper's 1.11.0 boundary bin.
 * 2. Record the findings capability boundary: the pinned 1.11.0 executable rejects
 *    `--report` (and `--report findings`) as an unknown option before any run.
 * 3. Keep boundary negatives executable so the v12 single-series window cannot
 *    silently re-admit a line that lacks the findings transport.
 *
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  expectPinnedVersion as expectPinnedV11Version,
  pinnedFixtureEnv as pinnedV11FixtureEnv,
  runPinnedOpenspec as runPinnedV11Openspec,
} from './__tests__/official-cli-v11-fixtures.js'
import {
  createPinnedFixtureRoot,
  pinnedFixtureEnv as pinnedV12FixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec as runPinnedV12Openspec,
} from './__tests__/official-cli-v12-fixtures.js'

describe('pinned OpenSpec 1.12 boundary fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  it('prints the exact line identity for both pinned executables', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-112-boundary-identity')
    const project = join(fixtureRoot, 'project')
    const v12Env = pinnedV12FixtureEnv(fixtureRoot)
    const v11Env = pinnedV11FixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // The provenance guard: each bins-map entry must print its own exact version.
    const v12 = await runPinnedV12Openspec('1.12.0', ['--version'], project, v12Env)
    expect(v12.exitCode, v12.stdout + '\n' + v12.stderr).toBe(0)
    expect(v12.stdout.trim()).toBe('1.12.0')

    await expectPinnedV11Version('1.11.0', project, v11Env)
  }, 60_000)

  it('keeps --report a 1.12-only capability on the pinned 1.11.0 executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1110-findings-boundary')
    const project = join(fixtureRoot, 'project')
    const env = pinnedV11FixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    const findings = await runPinnedV11Openspec(
      '1.11.0',
      ['validate', '--all', '--report', 'findings', '--json'],
      project,
      env
    )
    // 1.11 rejects the flag as an unknown option; no JSON document is produced.
    expect(findings.exitCode).toBe(1)
    expect(findings.stderr).toContain("unknown option '--report'")
    expect(findings.stdout.trim()).toBe('')

    // The request value does not matter on 1.11: the flag itself is unknown.
    const full = await runPinnedV11Openspec(
      '1.11.0',
      ['validate', '--all', '--report', 'full', '--json'],
      project,
      env
    )
    expect(full.exitCode).toBe(1)
    expect(full.stderr).toContain("unknown option '--report'")
    expect(full.stdout.trim()).toBe('')
  }, 60_000)
})
