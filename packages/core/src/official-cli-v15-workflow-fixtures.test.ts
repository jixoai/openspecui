/**
 * Orthogonal intents (updated 2026-10-29 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.15.0 workflow contract end to end: skipped Status,
 *    tasks/Apply/Archive Instructions on one real skip-specs change.
 * 2. Prove explicit planning completion (`isPlanningComplete`) stays protocol truth while
 *    `isComplete` remains retained alias evidence, and Apply `progress` stays authoritative
 *    over the actionable task list (planning/task separation).
 * 3. Prove Apply and Archive operation guidance stays distinct from artifact rules.
 * 4. Prove `init --language` persists the fixed context block and never overwrites config.
 * 5. Prove the JSON stream discipline: one stdout document, stderr without
 *    telemetry or completion-tip noise.
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
 * Original request (2026-08-01): adapt the complete observable OpenSpec 1.7 workflow protocol.
 * Original request (2026-10-29): "检查一下上游openspec是否发布新版本，如果我们按照规范跟进更新" — positive matrix migrates to the pinned 1.15.0 executable (v15 line).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V15_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  expectPinnedVersion,
  parsePinnedJson,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV15Version,
} from './__tests__/official-cli-v15-fixtures.js'
import { CliDiagnosticFailureSchema } from './cli-contracts/common.js'
import {
  CliApplyInstructionsSuccessSchema,
  CliArchiveInstructionsSuccessSchema,
  CliArtifactInstructionsSuccessSchema,
  CliWorkflowStatusSuccessSchema,
} from './cli-contracts/workflow.js'

async function initProject(
  version: PinnedOpenspecV15Version,
  project: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const initialized = await runPinnedOpenspec(
    version,
    ['init', project, '--tools=none'],
    project,
    env
  )
  expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)
}

describe('pinned OpenSpec 1.15 workflow fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V15_VERSIONS) {
    it(`executes skipped Status plus Apply and Archive Instructions on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-workflow`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)

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
      // Planning completion is explicit protocol truth and isComplete stays retained
      // alias evidence, not the projection authority.
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
      await initProject(version, project, env)

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
      // is only the actionable presentation. 1.14 LocatedTask members ride every
      // entry: absolute sourcePath plus 1-based line (tasks.md lines 3 and 4).
      expect(apply.progress).toEqual({ total: 3, complete: 1, remaining: 2 })
      const tasksPath = join(apply.changeDir, 'tasks.md')
      expect(apply.tasks).toEqual([
        { id: '1', description: 'Plan the migration', done: true, sourcePath: tasksPath, line: 3 },
        {
          id: '2',
          description: 'Nested sub-task counted by progress',
          done: false,
          sourcePath: tasksPath,
          line: 4,
        },
      ])
      expect(apply.tasks.length).toBe(2)
      expect(apply.state).toBe('ready')
    }, 60_000)

    it(`persists the fixed three-line context block for init --language on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-language`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)

      const initialized = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none', '--language', 'Chinese'],
        project,
        env
      )
      expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

      // `--language` writes a fixed three-line block under the existing `context`
      // field; it is not a new config key and needs no dedicated OpenSpecUI editor.
      const config = await readFile(join(project, 'openspec', 'config.yaml'), 'utf8')
      expect(config).toContain('context: |\n')
      expect(config).toContain('  Language: Chinese\n')
      expect(config).toContain('  All artifacts must be written in Chinese.\n')
      expect(config).toContain(
        '  Keep OpenSpec structural headings and SHALL/MUST keywords in English.\n'
      )

      // init never overwrites an existing config; the language instruction belongs to
      // the Active Root context field after initialization.
      const reinitialized = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none', '--language', 'French'],
        project,
        env
      )
      expect(reinitialized.exitCode).not.toBe(0)
      expect(reinitialized.stderr).toContain('--language does not overwrite')
      const afterReject = await readFile(join(project, 'openspec', 'config.yaml'), 'utf8')
      expect(afterReject).toContain('Language: Chinese')
      expect(afterReject).not.toContain('French')
    }, 60_000)

    it(`keeps JSON runs to one stdout document with telemetry-free stderr on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-json-clean`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      // expectPinnedVersion doubles as the stdout purity proof: strict equality on the
      // trimmed stdout fails if any telemetry or tip text shares the stream.
      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)

      for (const args of [
        ['schemas', '--json'],
        ['list', '--json'],
      ]) {
        const result = await runPinnedOpenspec(version, args, project, env)
        expect(result.exitCode, result.stdout + '\n' + result.stderr).toBe(0)
        expectPinnedJsonDiscipline(result)
      }
    }, 60_000)

    it(`admits x- extension metadata keys while malformed X- keys keep the advisory on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-metadata-keys`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)

      const created = await runPinnedOpenspec(
        version,
        ['new', 'change', 'extension-keys'],
        project,
        env
      )
      expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
      const changeDir = join(project, 'openspec', 'changes', 'extension-keys')
      await writeFile(join(changeDir, 'proposal.md'), '# Proposal\n\nExtension metadata keys.\n')

      // 1.14.2 (upstream #2063): a top-level key matching /^x-\S+$/ is someone else's
      // tool metadata (OpenAPI-style), not an unknown key — Status and Instructions
      // carry no advisory at all.
      await writeFile(
        join(changeDir, '.openspec.yaml'),
        'schema: spec-driven\ncreated: 2026-10-16\nx-tracker: JIRA-123\n'
      )
      const extensionStatus = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['status', '--change', 'extension-keys', '--json'],
          project,
          env
        ),
        (payload) => CliWorkflowStatusSuccessSchema.parse(payload)
      )
      expect(extensionStatus.warnings).toBeUndefined()
      const extensionInstructions = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['instructions', 'proposal', '--change', 'extension-keys', '--json'],
          project,
          env
        ),
        (payload) => CliArtifactInstructionsSuccessSchema.parse(payload)
      )
      expect(extensionInstructions.warnings).toBeUndefined()

      // A capital-X key is malformed (the prefix is lowercase-only), so the unknown-key
      // advisory stays — now carrying the 1.14.2 hint that names the x- escape hatch.
      await writeFile(
        join(changeDir, '.openspec.yaml'),
        'schema: spec-driven\ncreated: 2026-10-16\nX-Foo: 1\n'
      )
      const malformedStatus = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['status', '--change', 'extension-keys', '--json'],
          project,
          env
        ),
        (payload) => CliWorkflowStatusSuccessSchema.parse(payload)
      )
      expect(malformedStatus.warnings).toHaveLength(1)
      const warning = malformedStatus.warnings?.[0] ?? ''
      expect(warning).toContain('Unrecognized key name(s) in .openspec.yaml')
      expect(warning).toContain(': X-Foo.')
      expect(warning).toContain('Unknown keys are ignored and have no effect')
      expect(warning).toContain(
        'prefix a key with x- (for example x-tracker) to keep tool-specific metadata without this warning'
      )
      expect(warning).toContain('An x- extension key needs a lowercase x- prefix')
      // Instructions reports the same advisory verbatim: one shared hygiene read.
      const malformedInstructions = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['instructions', 'proposal', '--change', 'extension-keys', '--json'],
          project,
          env
        ),
        (payload) => CliArtifactInstructionsSuccessSchema.parse(payload)
      )
      expect(malformedInstructions.warnings).toEqual(malformedStatus.warnings)
    }, 60_000)

    it(`rejects artifact patterns nesting brace expansions deeper than 16 levels on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-brace-depth`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)

      const initialized = await runPinnedOpenspec(
        version,
        ['schema', 'init', 'deep-brace'],
        project,
        env
      )
      expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

      const created = await runPinnedOpenspec(
        version,
        ['new', 'change', 'deep-pattern'],
        project,
        env
      )
      expect(created.exitCode, created.stdout + '\n' + created.stderr).toBe(0)
      const changeDir = join(project, 'openspec', 'changes', 'deep-pattern')
      await writeFile(join(changeDir, 'proposal.md'), '# Proposal\n\nDeep brace pattern.\n')
      await writeFile(join(changeDir, '.openspec.yaml'), 'schema: deep-brace\n')

      // Only a real brace expansion (comma-separated alternation) reaches the braces
      // parser, so the depth guard sees nesting, not literal decoration.
      const schemaPath = join(project, 'openspec', 'schemas', 'deep-brace', 'schema.yaml')
      const pristineSchema = await readFile(schemaPath, 'utf8')
      const setProposalPattern = async (opens: number): Promise<void> => {
        const pattern = `${'{'.repeat(opens)}a,b${'}'.repeat(opens)}`
        // Always patch the pristine schema text so the second call cannot anchor on
        // the first call's already-rewritten generates line.
        await writeFile(
          schemaPath,
          pristineSchema.replace('generates: proposal.md', `generates: "${pattern}"`)
        )
      }

      // 16 levels is the deepest legal nesting and still answers instructions.
      await setProposalPattern(16)
      const boundary = parsePinnedSuccessJson(
        await runPinnedOpenspec(
          version,
          ['instructions', 'proposal', '--change', 'deep-pattern', '--json'],
          project,
          env
        ),
        (payload) => CliArtifactInstructionsSuccessSchema.parse(payload)
      )
      expect(boundary.outputPath).toBe(`${'{'.repeat(16)}a,b${'}'.repeat(16)}`)

      // 17 levels is rejected before the pattern reaches the braces parser
      // (upstream GHSA-vfj7-8cjw-p6xm guard): Status and Instructions fail through
      // the typed change_error envelope with the depth message.
      await setProposalPattern(17)
      for (const args of [
        ['status', '--change', 'deep-pattern', '--json'],
        ['instructions', 'proposal', '--change', 'deep-pattern', '--json'],
      ]) {
        const result = await runPinnedOpenspec(version, args, project, env)
        expect(result.exitCode, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`).toBe(1)
        expectPinnedJsonDiscipline(result)
        const failure = parsePinnedJson(result, (payload) =>
          CliDiagnosticFailureSchema.parse(payload)
        )
        expect(failure.status[0]).toMatchObject({
          severity: 'error',
          code: 'change_error',
        })
        expect(failure.status[0].message).toContain(
          'Artifact output pattern nests braces more than 16 levels deep:'
        )
      }
    }, 60_000)
  }
})
