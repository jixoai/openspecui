/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.7 CLI workflow contracts from `references/openspec`.
 * 2. Prove skipped dependency identity without physical spec files.
 * 3. Prove Apply and Archive operation inputs remain distinct from artifact rules.
 *
 * Original request (2026-08-01): adapt the complete observable OpenSpec 1.7 workflow protocol.
 */
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  CliApplyInstructionsSuccessSchema,
  CliArchiveInstructionsSuccessSchema,
  CliArtifactInstructionsSuccessSchema,
  CliWorkflowStatusSuccessSchema,
} from './cli-contracts/workflow.js'

const OPENSPEC_17_BIN = resolve(import.meta.dirname, '../../../references/openspec/bin/openspec.js')

interface CliRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

function fixtureEnv(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: join(root, 'home'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_DATA_HOME: join(root, 'data'),
    XDG_STATE_HOME: join(root, 'state'),
    XDG_CACHE_HOME: join(root, 'cache'),
    OPEN_SPEC_INTERACTIVE: '0',
    OPENSPEC_TELEMETRY: '0',
    NO_COLOR: '1',
  }
}

function runCli(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<CliRunResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [OPENSPEC_17_BIN, ...args],
      { cwd, env, maxBuffer: 4 * 1024 * 1024, timeout: 30_000 },
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

function parseJson<T>(result: CliRunResult, schema: z.ZodType<T>): T {
  expect(result.exitCode, result.stdout + '\n' + result.stderr).toBe(0)
  return schema.parse(JSON.parse(result.stdout))
}

describe('pinned OpenSpec 1.7 workflow fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true })
    fixtureRoot = null
  })

  it('executes skipped Status plus Apply and Archive Instructions on one selected Root', async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), 'openspecui-cli-17-workflow-'))
    const project = join(fixtureRoot, 'project')
    const env = fixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    const version = await runCli(['--version'], project, env)
    expect(version.exitCode).toBe(0)
    expect(version.stdout.trim()).toBe('1.7.0')

    const initialized = await runCli(['init', project, '--tools=none'], project, env)
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    const created = await runCli(['new', 'change', 'skip-specs'], project, env)
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

    const status = parseJson(
      await runCli(['status', '--change', 'skip-specs', '--json'], project, env),
      CliWorkflowStatusSuccessSchema
    )
    const skippedSpecs = status.artifacts.find((artifact) => artifact.id === 'specs')
    expect(skippedSpecs).toMatchObject({
      status: 'skipped',
      requires: ['proposal'],
    })
    expect(status.artifactPaths.specs?.existingOutputPaths).toEqual([])

    const tasks = parseJson(
      await runCli(['instructions', 'tasks', '--change', 'skip-specs', '--json'], project, env),
      CliArtifactInstructionsSuccessSchema
    )
    expect(tasks.dependencies.find((dependency) => dependency.id === 'specs')).toMatchObject({
      done: true,
      skipped: true,
    })

    const apply = parseJson(
      await runCli(['instructions', 'apply', '--change', 'skip-specs', '--json'], project, env),
      CliApplyInstructionsSuccessSchema
    )
    expect(apply.context).toBe('Authentication changes require a threat model.')
    expect(apply.operationGuidance).toEqual(['Run security-focused tests before completion.'])
    expect(JSON.stringify(apply.operationGuidance)).not.toContain('Artifact-only rule')

    const archive = parseJson(
      await runCli(['instructions', 'archive', '--change', 'skip-specs', '--json'], project, env),
      CliArchiveInstructionsSuccessSchema
    )
    expect(archive.context).toBe('Authentication changes require a threat model.')
    expect(archive.operationGuidance).toEqual(['Review the final delta before moving the change.'])
    expect(JSON.stringify(archive.operationGuidance)).not.toContain('Artifact-only rule')
  }, 60_000)
})
