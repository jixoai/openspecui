/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.8.0 and 1.9.0 workflow contracts side by side.
 * 2. Prove explicit planning completion and retained isComplete evidence on both lines.
 * 3. Prove skipped dependency identity without physical spec files.
 * 4. Prove Apply and Archive operation inputs remain distinct from artifact rules.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-01): adapt the complete observable OpenSpec 1.7 workflow protocol.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V9_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedVersion,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v9-fixtures.js'
import {
  CliApplyInstructionsSuccessSchema,
  CliArchiveInstructionsSuccessSchema,
  CliArtifactInstructionsSuccessSchema,
  CliWorkflowStatusSuccessSchema,
} from './cli-contracts/workflow.js'

describe('pinned OpenSpec 1.8/1.9 workflow fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V9_VERSIONS) {
    it(`executes skipped Status plus Apply and Archive Instructions on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-workflow`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)

      const initialized = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

      const created = await runPinnedOpenspec(
        version,
        ['new', 'change', 'skip-specs'],
        project,
        env
      )
      expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)

      const changeDir = join(project, 'openspec', 'changes', 'skip-specs')
      await writeFile(
        join(project, 'openspec', 'config.yaml'),
        [
          'schema: spec-driven',
          'context: Authentication changes require a threat model.',
          'operations:',
          '  apply:',
          '    guidance:',
          '      - Run security-focused tests before completion.',
          '  archive:',
          '    guidance:',
          '      - Review the final delta before moving the change.',
          'rules:',
          '  specs:',
          '    - Artifact-only rule that must not become operation guidance.',
          '',
        ].join('\n')
      )
      await writeFile(join(changeDir, '.openspec.yaml'), 'schema: spec-driven\nskip_specs: true\n')
      await writeFile(
        join(changeDir, 'proposal.md'),
        '# Proposal\n\nSkip delta specs intentionally.\n'
      )

      const status = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['status', '--change', 'skip-specs', '--json'],
          project,
          env
        ),
        (payload) => CliWorkflowStatusSuccessSchema.parse(payload)
      )
      const skippedSpecs = status.artifacts.find((artifact) => artifact.id === 'specs')
      expect(skippedSpecs).toMatchObject({
        status: 'skipped',
        requires: ['proposal'],
      })
      expect(status.artifactPaths.specs?.existingOutputPaths).toEqual([])
      // Planning completion is explicit protocol truth on both supported lines and
      // isComplete stays retained alias evidence, not the projection authority.
      expect(typeof status.isPlanningComplete).toBe('boolean')
      expect(typeof status.isComplete).toBe('boolean')

      const tasks = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['instructions', 'tasks', '--change', 'skip-specs', '--json'],
          project,
          env
        ),
        (payload) => CliArtifactInstructionsSuccessSchema.parse(payload)
      )
      expect(tasks.dependencies.find((dependency) => dependency.id === 'specs')).toMatchObject({
        done: true,
        skipped: true,
      })

      const apply = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['instructions', 'apply', '--change', 'skip-specs', '--json'],
          project,
          env
        ),
        (payload) => CliApplyInstructionsSuccessSchema.parse(payload)
      )
      expect(apply.context).toBe('Authentication changes require a threat model.')
      expect(apply.operationGuidance).toEqual(['Run security-focused tests before completion.'])
      expect(JSON.stringify(apply.operationGuidance)).not.toContain('Artifact-only rule')

      const archive = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['instructions', 'archive', '--change', 'skip-specs', '--json'],
          project,
          env
        ),
        (payload) => CliArchiveInstructionsSuccessSchema.parse(payload)
      )
      expect(archive.context).toBe('Authentication changes require a threat model.')
      expect(archive.operationGuidance).toEqual([
        'Review the final delta before moving the change.',
      ])
      expect(JSON.stringify(archive.operationGuidance)).not.toContain('Artifact-only rule')
    }, 60_000)

    it(`keeps Apply progress authoritative over the actionable task list on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-apply-progress`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)

      const initialized = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

      const created = await runPinnedOpenspec(
        version,
        ['new', 'change', 'mixed-tasks'],
        project,
        env
      )
      expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)

      const changeDir = join(project, 'openspec', 'changes', 'mixed-tasks')
      await writeFile(
        join(changeDir, 'proposal.md'),
        '# Proposal\n\nExercise indented and blank-description checkbox counting.\n'
      )
      await writeFile(
        join(changeDir, 'tasks.md'),
        [
          '# Tasks',
          '',
          '- [x] Plan the migration',
          '  - [ ] Nested sub-task counted by progress',
          '- [ ]',
          '',
        ].join('\n')
      )

      const apply = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['instructions', 'apply', '--change', 'mixed-tasks', '--json'],
          project,
          env
        ),
        (payload) => CliApplyInstructionsSuccessSchema.parse(payload)
      )

      // The upstream parser counts every checkbox line, including indented
      // sub-tasks and blank-description lines; the actionable tasks list hides
      // blank-description entries. progress is the denominator, tasks.length
      // is only the actionable presentation.
      expect(apply.progress).toEqual({ total: 3, complete: 1, remaining: 2 })
      expect(apply.tasks).toEqual([
        { id: '1', description: 'Plan the migration', done: true },
        { id: '2', description: 'Nested sub-task counted by progress', done: false },
      ])
      expect(apply.tasks.length).toBe(2)
      expect(apply.state).toBe('ready')
    }, 60_000)
  }
})
