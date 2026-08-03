/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.7 CLI against machine `defaultStore` root selection.
 * 2. Prove effective, absent, and stale fallback outcomes preserve upstream provenance and fixes.
 *
 * Original request (2026-08-01): adapt OpenSpec 1.7 machine `defaultStore` without fabricating effective Root truth.
 */
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { CliDiagnosticFailureSchema } from './cli-contracts/common.js'
import { CliContextSchema, CliDoctorSchema } from './cli-contracts/store.js'

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
  return schema.parse(JSON.parse(result.stdout))
}

describe('pinned OpenSpec 1.7 defaultStore fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true })
    fixtureRoot = null
  })

  it('reports global_default only when the configured Store is selected effectively', async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), 'openspecui-cli-17-default-store-'))
    const storeRoot = join(fixtureRoot, 'team-context')
    const scratch = join(fixtureRoot, 'scratch')
    const env = fixtureEnv(fixtureRoot)
    await mkdir(join(storeRoot, 'openspec', 'specs'), { recursive: true })
    await mkdir(join(storeRoot, 'openspec', 'changes', 'archive'), { recursive: true })
    await mkdir(scratch, { recursive: true })
    await writeFile(join(storeRoot, 'openspec', 'config.yaml'), 'schema: spec-driven\n')
    const physicalStoreRoot = await realpath(storeRoot)

    const registered = await runCli(
      ['store', 'register', storeRoot, '--id', 'team-context', '--yes', '--json'],
      scratch,
      env
    )
    expect(registered.exitCode, registered.stdout + registered.stderr).toBe(0)
    const configured = await runCli(
      ['config', 'set', 'defaultStore', 'team-context', '--string'],
      scratch,
      env
    )
    expect(configured.exitCode, configured.stdout + configured.stderr).toBe(0)

    const doctorResult = await runCli(['doctor', '--json'], scratch, env)
    expect(doctorResult.exitCode, doctorResult.stdout + doctorResult.stderr).toBe(0)
    expect(parseJson(doctorResult, CliDoctorSchema).root).toMatchObject({
      path: physicalStoreRoot,
      source: 'global_default',
      store_id: 'team-context',
    })

    const contextResult = await runCli(['context', '--json'], scratch, env)
    expect(contextResult.exitCode, contextResult.stdout + contextResult.stderr).toBe(0)
    expect(parseJson(contextResult, CliContextSchema).root).toMatchObject({
      path: physicalStoreRoot,
      source: 'global_default',
      store_id: 'team-context',
    })
  }, 30_000)

  it('keeps absent and stale fallback failures distinct', async () => {
    fixtureRoot = await mkdtemp(join(tmpdir(), 'openspecui-cli-17-default-store-'))
    const scratch = join(fixtureRoot, 'scratch')
    const env = fixtureEnv(fixtureRoot)
    await mkdir(scratch, { recursive: true })

    const absent = await runCli(['doctor', '--json'], scratch, env)
    expect(absent.exitCode).toBe(1)
    expect(parseJson(absent, CliDiagnosticFailureSchema).status[0]?.code).toBe('no_openspec_root')

    const configured = await runCli(
      ['config', 'set', 'defaultStore', 'ghost-plans', '--string'],
      scratch,
      env
    )
    expect(configured.exitCode, configured.stdout + configured.stderr).toBe(0)
    const stale = await runCli(['doctor', '--json'], scratch, env)
    expect(stale.exitCode).toBe(1)
    expect(parseJson(stale, CliDiagnosticFailureSchema).status[0]).toMatchObject({
      code: 'no_registered_stores',
      message: expect.stringContaining("Global defaultStore 'ghost-plans'"),
      fix: expect.stringContaining('openspec config unset defaultStore'),
    })
  }, 30_000)
})
