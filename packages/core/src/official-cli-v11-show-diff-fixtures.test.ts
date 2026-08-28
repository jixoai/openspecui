/**
 * Orthogonal intents (created 2026-08-28 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.11.0 `show <change> --json --diff` contract against a
 *    real fixture project: MODIFIED deltas carry the unified diff body and optional warning.
 * 2. Prove the diff is CLI-owned evidence (`@@` hunks, `-`/`+` lines, no warning on a clean
 *    modification; the exact upstream near-miss header warning when names differ in case).
 * 3. Prove the 1.10.0 capability boundary: `--diff` is not an admitted flag there.
 *
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  expectPinnedVersion,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v11-fixtures.js'
import { CliShowChangeDiffSuccessSchema } from './cli-contracts/show-diff.js'

const MAIN_SPEC = [
  '## Purpose',
  'Billing rules.',
  '',
  '## Requirements',
  '',
  '### Requirement: Billing rules',
  'The system SHALL apply billing rules.',
  '',
  '#### Scenario: Existing behavior',
  '- **WHEN** billing runs',
  '- **THEN** billing succeeds',
  '',
].join('\n')

async function createChangeWithDelta(
  project: string,
  env: NodeJS.ProcessEnv,
  changeId: string,
  delta: string
): Promise<void> {
  const created = await runPinnedOpenspec('1.11.0', ['new', 'change', changeId], project, env)
  expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
  const changeDir = join(project, 'openspec', 'changes', changeId)
  await mkdir(join(changeDir, 'specs', 'billing'), { recursive: true })
  await writeFile(
    join(changeDir, 'proposal.md'),
    [
      '## Why',
      `${changeId} needs a contract update.`,
      '',
      '## What Changes',
      `- Update billing behavior for ${changeId}.`,
      '',
    ].join('\n')
  )
  await writeFile(join(changeDir, 'specs', 'billing', 'spec.md'), delta)
}

describe('pinned OpenSpec 1.11 show --diff fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  it('attaches a unified diff with hunks to a clean MODIFIED delta', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1110-show-diff')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(join(project, 'openspec', 'specs', 'billing'), { recursive: true })
    await writeFile(join(project, 'openspec', 'specs', 'billing', 'spec.md'), MAIN_SPEC)

    await expectPinnedVersion('1.11.0', project, env)

    const initialized = await runPinnedOpenspec(
      '1.11.0',
      ['init', project, '--tools=none'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    await createChangeWithDelta(
      project,
      env,
      'modify-billing',
      [
        '## MODIFIED Requirements',
        '',
        '### Requirement: Billing rules',
        'The system SHALL apply billing rules with retry.',
        '',
        '#### Scenario: Existing behavior',
        '- **WHEN** billing runs',
        '- **THEN** billing succeeds with retry',
        '',
      ].join('\n')
    )

    const result = await runPinnedOpenspec(
      '1.11.0',
      ['show', 'modify-billing', '--json', '--diff'],
      project,
      env
    )
    expectPinnedJsonDiscipline(result)
    const shown = parsePinnedSuccessJson(result, (payload) =>
      CliShowChangeDiffSuccessSchema.parse(payload)
    )

    expect(shown.id).toBe('modify-billing')
    expect(shown.deltaCount).toBe(1)
    // The payload carries the selected root; the diff is separately fetched CLI evidence.
    expect(shown.root.path).toContain('project')

    const delta = shown.deltas[0]
    expect(delta.spec).toBe('billing')
    expect(delta.operation).toBe('MODIFIED')
    // Unified-diff body: @@ hunk headers plus removed/added lines, no synthetic file
    // headers and no warning for an exactly matching requirement header.
    expect(delta.diff).toBeDefined()
    expect(delta.diff).toMatch(/^@@ -1,\d+ \+1,\d+ @@/)
    expect(delta.diff).toContain('-The system SHALL apply billing rules.')
    expect(delta.diff).toContain('+The system SHALL apply billing rules with retry.')
    expect(delta.diff).not.toContain('--- ')
    expect(delta.diff).not.toContain('+++ ')
    expect(delta.warning).toBeUndefined()
  }, 60_000)

  it('carries the exact upstream near-miss header warning beside its diff', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1110-show-diff-warning')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(join(project, 'openspec', 'specs', 'billing'), { recursive: true })
    await writeFile(join(project, 'openspec', 'specs', 'billing', 'spec.md'), MAIN_SPEC)

    const initialized = await runPinnedOpenspec(
      '1.11.0',
      ['init', project, '--tools=none'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    // The header differs from the main spec's requirement only in case, so archive will
    // not merge it; the CLI still shows the diff the author meant plus the warning.
    await createChangeWithDelta(
      project,
      env,
      'near-miss',
      [
        '## MODIFIED Requirements',
        '',
        '### Requirement: Billing Rules',
        'The system SHALL apply billing rules with retry.',
        '',
      ].join('\n')
    )

    const result = await runPinnedOpenspec(
      '1.11.0',
      ['show', 'near-miss', '--json', '--diff'],
      project,
      env
    )
    const shown = parsePinnedSuccessJson(result, (payload) =>
      CliShowChangeDiffSuccessSchema.parse(payload)
    )

    const delta = shown.deltas[0]
    expect(delta.operation).toBe('MODIFIED')
    // One of the three exact upstream warning texts: near-miss header naming the main
    // spec's requirement and the archive merge consequence.
    expect(delta.warning).toBe(
      'Header differs from the main spec\'s "Billing rules" only in case or spacing; ' +
        'archive matches names exactly, so reconcile them before archiving'
    )
    expect(delta.diff).toBeDefined()
    expect(delta.diff).toMatch(/^@@ /)
  }, 60_000)

  it('keeps show --diff a 1.11-only capability on the pinned 1.10.0 executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-1100-show-diff-boundary')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(join(project, 'openspec', 'specs', 'billing'), { recursive: true })
    await writeFile(join(project, 'openspec', 'specs', 'billing', 'spec.md'), MAIN_SPEC)

    await expectPinnedVersion('1.10.0', project, env)

    const initialized = await runPinnedOpenspec(
      '1.10.0',
      ['init', project, '--tools=none'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    const created = await runPinnedOpenspec('1.10.0', ['new', 'change', 'legacy'], project, env)
    expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
    const changeDir = join(project, 'openspec', 'changes', 'legacy')
    await mkdir(join(changeDir, 'specs', 'billing'), { recursive: true })
    await writeFile(
      join(changeDir, 'proposal.md'),
      ['## Why', 'Legacy line has no diff flag.', '', '## What Changes', '- None.', ''].join('\n')
    )
    await writeFile(
      join(changeDir, 'specs', 'billing', 'spec.md'),
      ['## MODIFIED Requirements', '', '### Requirement: Billing rules', 'Changed.', ''].join('\n')
    )

    const result = await runPinnedOpenspec(
      '1.10.0',
      ['show', 'legacy', '--json', '--diff'],
      project,
      env
    )
    // 1.10 does not know `--diff`; commander treats it as an extra positional argument
    // and rejects the invocation with no JSON on stdout.
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain("too many arguments for 'show'")
    expect(result.stdout.trim()).toBe('')
  }, 60_000)
})
