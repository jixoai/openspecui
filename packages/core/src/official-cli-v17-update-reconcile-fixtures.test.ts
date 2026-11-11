/**
 * Orthogonal intents (created 2026-11-11 Asia/Shanghai):
 * 1. Prove the OpenSpec 1.17 update rework as an executable fact: moving a real Claude Code
 *    project to skills-only delivery removes the five untouched generated command files while
 *    keeping a hand-edited command, and reports the kept file by path.
 * 2. Prove the deprecation notice is emitted while delivery still includes commands, so a
 *    future command-file removal is announced before it happens.
 * 3. Assert both the file-system state and the human-readable stdout; exit codes alone are not
 *    evidence that the reconcile kept or removed the right file.
 *
 * Original request (2026-11-11): "开工" — update-openspec-cli-17 Slice 2 fixture matrix.
 * 2026-11-11 (update-openspec-cli-17): created as the positive proof for the 1.17 update
 *   reconcile and command-file deprecation notice.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPinnedFixtureRoot,
  expectPinnedVersion,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v17-fixtures.js'

const COMMAND_DIR = join('.claude', 'commands', 'opsx')
const EDITED_COMMAND_PATH = '.claude/commands/opsx/apply.md'

const ALL_COMMAND_FILES = [
  'apply.md',
  'archive.md',
  'explore.md',
  'propose.md',
  'sync.md',
  'update.md',
]

describe('pinned OpenSpec 1.17 update reconcile fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  it('keeps a hand-edited command while removing the other five on skills-only delivery', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-117-update-reconcile-kept')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })
    const version = '1.17.0' as const

    await expectPinnedVersion(version, project, env)
    const initialized = await runPinnedOpenspec(
      version,
      ['init', project, '--tools=claude'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    const commandDir = join(project, COMMAND_DIR)
    const before = (await readdir(commandDir)).sort()
    expect(before).toEqual(ALL_COMMAND_FILES)

    const editedCommand = join(project, EDITED_COMMAND_PATH)
    const original = await readFile(editedCommand, 'utf8')
    await writeFile(editedCommand, original + '\n<!-- hand edit -->\n')

    const configured = await runPinnedOpenspec(
      version,
      ['config', 'set', 'delivery', 'skills'],
      project,
      env
    )
    expect(configured.exitCode, configured.stdout + '\n' + configured.stderr).toBe(0)

    const updated = await runPinnedOpenspec(version, ['update'], project, env)
    expect(updated.exitCode, updated.stdout + '\n' + updated.stderr).toBe(0)

    // File-system proof: exactly five of the six generated files are gone and the edited
    // command survives with its edit intact.
    const after = (await readdir(commandDir)).sort()
    expect(after).toEqual(['apply.md'])
    const removed = before.filter((name) => !after.includes(name))
    expect(removed).toHaveLength(5)
    expect(await readFile(editedCommand, 'utf8')).toBe(original + '\n<!-- hand edit -->\n')

    // Stdout proof: the reconcile reports what it kept and names the exact path.
    expect(updated.stdout).toContain('Removed: 5 command files (delivery: skills)')
    expect(updated.stdout).toContain('Kept 1 command file')
    expect(updated.stdout).toContain(EDITED_COMMAND_PATH)
  }, 120_000)

  it('announces the command-file deprecation while delivery still includes commands', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-117-update-deprecation-notice')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })
    const version = '1.17.0' as const

    await expectPinnedVersion(version, project, env)
    const initialized = await runPinnedOpenspec(
      version,
      ['init', project, '--tools=claude'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    // Delivery still includes commands, so the notice appears on a routine update.
    const updated = await runPinnedOpenspec(version, ['update'], project, env)
    expect(updated.exitCode, updated.stdout + '\n' + updated.stderr).toBe(0)
    expect(updated.stdout).toContain('Command files are deprecated')

    // The notice is advice, not a mutation: the command files remain on disk.
    const commandDir = join(project, COMMAND_DIR)
    expect((await readdir(commandDir)).sort()).toEqual(ALL_COMMAND_FILES)
  }, 120_000)
})
