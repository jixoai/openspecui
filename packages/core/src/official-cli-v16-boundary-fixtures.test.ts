/**
 * Orthogonal intents (created 2026-11-11 Asia/Shanghai):
 * 1. Prove the executable identity of the just-retired boundary line: the kept
 *    `openspec-cli-116` npm alias prints exactly 1.16.1 — the line the v17 gate revoked
 *    (below-admitted for the `>=1.17.0 <1.18.0` window).
 * 2. Prove the production v17 gate classifies 1.16.1 as `unsupported`, so the
 *    single-series window cannot silently re-admit the v16 line.
 * 3. Record the 1.17-only update rework as absent on the boundary executable: with a
 *    hand-edited `.claude/commands/opsx/apply.md`, `config set delivery skills` followed by
 *    `update` deletes all six command files (the edited one included) and never prints the
 *    1.17 `Command files are deprecated` notice. This proves what 1.17 added, never that a
 *    v16-era member disappeared.
 *
 * Original request (2026-11-11): "开工" — update-openspec-cli-17 Slice 2 opens the v17 line and
 *   rotates the fixture matrix; the v16 alias remains installed as the below-admitted boundary.
 * 2026-11-11 (update-openspec-cli-17): created as the below-admitted boundary suite for the
 *   `>=1.17.0 <1.18.0` window, driven by the retained 1.16.1 executable.
 */
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPinnedFixtureRoot,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
} from './__tests__/official-cli-v17-fixtures.js'
import { classifyOpenSpecCliVersion } from './openspec-compat.js'

/** The retired below-admitted boundary executable kept through the openspec-cli-116 alias. */
const RETIRED_V16_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-116/bin/openspec.js'
)

const COMMAND_DIR = join('.claude', 'commands', 'opsx')

interface BoundaryRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

function runRetiredV16Openspec(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<BoundaryRunResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [RETIRED_V16_BIN, ...args],
      { cwd, env, maxBuffer: 4 * 1024 * 1024, timeout: 30_000, windowsHide: true },
      (error, stdout, stderr) => {
        complete({
          exitCode: typeof error?.code === 'number' ? error.code : error ? 1 : 0,
          stdout,
          stderr,
        })
      }
    )
  })
}

describe('pinned OpenSpec 1.16 boundary fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  it('prints the exact line identity for the boundary executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-116-boundary-identity')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // Exact equality, never a prefix: the provenance guard must fail if the alias ever
    // resolves to another 1.16 patch or to the admitted 1.17.0 line.
    const version = await runRetiredV16Openspec(['--version'], project, env)
    expect(version.exitCode, version.stdout + '\n' + version.stderr).toBe(0)
    expect(version.stdout.trim()).toBe('1.16.1')
  }, 60_000)

  it('classifies the retired 1.16.1 line as unsupported under the v17 gate', () => {
    const compatibility = classifyOpenSpecCliVersion('1.16.1')
    expect(compatibility.status).toBe('unsupported')
    expect(compatibility.supported).toBe(false)
    expect(compatibility.recommended).toBe(false)
  })

  it('keeps the 1.17-only update reconcile absent on the boundary executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-116-boundary-update-reconcile')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    const initialized = await runRetiredV16Openspec(
      ['init', project, '--tools=claude'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    // Six command files are the core-profile default for Claude Code.
    const commandDir = join(project, COMMAND_DIR)
    const before = (await readdir(commandDir)).sort()
    expect(before).toEqual([
      'apply.md',
      'archive.md',
      'explore.md',
      'propose.md',
      'sync.md',
      'update.md',
    ])
    const editedCommand = join(commandDir, 'apply.md')
    const original = await readFile(editedCommand, 'utf8')
    await writeFile(editedCommand, original + '\n<!-- boundary edit -->\n')

    const configured = await runRetiredV16Openspec(
      ['config', 'set', 'delivery', 'skills'],
      project,
      env
    )
    expect(configured.exitCode, configured.stdout + '\n' + configured.stderr).toBe(0)

    const updated = await runRetiredV16Openspec(['update'], project, env)
    expect(updated.exitCode, updated.stdout + '\n' + updated.stderr).toBe(0)

    // 1.16.1 deletes every generated command file, including the edited one, and never
    // announces the 1.17 deprecation notice.
    expect(updated.stdout).toContain('Removed: 6 command files (delivery: skills)')
    expect(updated.stdout).not.toContain('Command files are deprecated')
    expect(updated.stdout).not.toContain('Kept 1 command file')
    // 1.16.1 may also prune the now-empty directory, so treat "missing" and "empty" alike:
    // the claim under test is that no command file survives.
    const remaining = await readdir(commandDir).catch(() => [] as string[])
    expect(remaining).toEqual([])
  }, 60_000)
})
