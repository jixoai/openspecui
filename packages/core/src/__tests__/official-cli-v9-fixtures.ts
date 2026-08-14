/**
 * Orthogonal intents (created 2026-08-15 Asia/Shanghai):
 * 1. Run the pinned OpenSpec 1.8.0 and 1.9.0 npm executables for v9 fixture matrices.
 * 2. Share one isolated fixture environment and hidden-console runner across fixture files.
 * 3. Keep fixture identity explicit so a passing matrix always names its executable line.
 *
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect } from 'vitest'

/** OpenSpec CLI lines admitted by the OpenSpecUI 9 compatibility law. */
export const PINNED_OPENSPEC_V9_VERSIONS = ['1.8.0', '1.9.0'] as const

export type PinnedOpenspecV9Version = (typeof PINNED_OPENSPEC_V9_VERSIONS)[number]

const PINNED_V9_BINS = {
  '1.8.0': resolve(import.meta.dirname, '../../node_modules/openspec-cli-18/bin/openspec.js'),
  '1.9.0': resolve(import.meta.dirname, '../../node_modules/openspec-cli-19/bin/openspec.js'),
} satisfies Record<PinnedOpenspecV9Version, string>

export interface CliRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

/** Isolated machine fixture environment: no shared HOME, config, data, state, or cache. */
export function pinnedFixtureEnv(root: string): NodeJS.ProcessEnv {
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

/** Execute one pinned OpenSpec executable with hidden console windows. */
export function runPinnedOpenspec(
  version: PinnedOpenspecV9Version,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<CliRunResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [PINNED_V9_BINS[version], ...args],
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

/** Assert the executable line identity before any contract assertion uses it. */
export async function expectPinnedVersion(
  version: PinnedOpenspecV9Version,
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const result = await runPinnedOpenspec(version, ['--version'], cwd, env)
  expect(result.exitCode, result.stdout + '\n' + result.stderr).toBe(0)
  expect(result.stdout.trim()).toBe(version)
}

/** Fixture root that removes itself in afterEach when handed back. */
export async function createPinnedFixtureRoot(label: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `openspecui-${label}-`))
}

/** Remove one fixture root created by {@link createPinnedFixtureRoot}. */
export async function removePinnedFixtureRoot(root: string | null): Promise<void> {
  if (!root) return
  await rm(root, { recursive: true, force: true })
}

/** Parse CLI JSON output through one schema without asserting the exit code. */
export function parsePinnedJson<T>(result: CliRunResult, parse: (payload: unknown) => T): T {
  return parse(JSON.parse(result.stdout))
}

/** Parse successful CLI JSON output through one schema, asserting exit code 0. */
export function parsePinnedSuccessJson<T>(result: CliRunResult, parse: (payload: unknown) => T): T {
  expect(result.exitCode, result.stdout + '\n' + result.stderr).toBe(0)
  return parse(JSON.parse(result.stdout))
}
