/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.7 CLI against a recursive owned Spec identity.
 * 2. Prove list and show preserve every identity segment and requirement content.
 * 3. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-01): adapt OpenSpec 1.7 nested Spec ids such as `platform/auth`.
 */
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { CliShowSpecSchema, CliSpecListSchema } from './cli-contracts/workflow.js'

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

function parseJson<T>(result: CliRunResult, schema: z.ZodType<T>): T {
  expect(result.exitCode, result.stdout + '\n' + result.stderr).toBe(0)
  return schema.parse(JSON.parse(result.stdout))
}

describe('pinned OpenSpec 1.7 nested Spec fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true })
    fixtureRoot = null
  })

  it('lists and shows platform/auth as one complete Spec identity', async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), 'openspecui-cli-17-nested-spec-'))
    const project = join(fixtureRoot, 'project')
    const env = fixtureEnv(fixtureRoot)
    await mkdir(join(project, 'openspec', 'specs', 'platform', 'auth'), { recursive: true })
    await writeFile(
      join(project, 'openspec', 'specs', 'platform', 'auth', 'spec.md'),
      [
        '## Purpose',
        'Define nested platform authentication behavior.',
        '',
        '## Requirements',
        '',
        '### Requirement: Nested authentication',
        'The platform SHALL preserve recursive Spec identity.',
        '',
        '#### Scenario: Show nested Spec',
        '- **WHEN** the nested Spec is listed and shown',
        '- **THEN** every identity segment is preserved',
        '',
      ].join('\n')
    )

    const version = await runCli(['--version'], project, env)
    expect(version.exitCode).toBe(0)
    expect(version.stdout.trim()).toBe('1.7.0')

    const listed = parseJson(
      await runCli(['list', '--specs', '--json'], project, env),
      CliSpecListSchema
    )
    expect(listed.specs).toContainEqual({ id: 'platform/auth', requirementCount: 1 })

    const shown = parseJson(
      await runCli(['show', 'platform/auth', '--type', 'spec', '--json'], project, env),
      CliShowSpecSchema
    )
    expect(shown).toMatchObject({
      id: 'platform/auth',
      requirementCount: 1,
      requirements: [
        {
          text: 'The platform SHALL preserve recursive Spec identity.',
        },
      ],
    })
  })
})
