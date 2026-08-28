/**
 * Orthogonal intents (created 2026-08-28 Asia/Shanghai):
 * 1. Run the pinned OpenSpec 1.10.0 and 1.11.0 npm executables for v11 fixture matrices.
 * 2. Share one isolated fixture environment and hidden-console runner across fixture files.
 * 3. Keep fixture identity explicit so a passing matrix always names its executable line.
 * 4. Assert the 1.10/1.11 JSON stream discipline: one stdout document, stderr free of
 *    telemetry/completion-tip noise (stdout purity is part of the admitted contract).
 *
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect } from 'vitest'

/** OpenSpec CLI lines admitted by the OpenSpecUI 11 compatibility law. */
export const PINNED_OPENSPEC_V11_VERSIONS = ['1.10.0', '1.11.0'] as const

export type PinnedOpenspecV11Version = (typeof PINNED_OPENSPEC_V11_VERSIONS)[number]

const PINNED_V11_BINS = {
  '1.10.0': resolve(import.meta.dirname, '../../node_modules/openspec-cli-110/bin/openspec.js'),
  '1.11.0': resolve(import.meta.dirname, '../../node_modules/openspec-cli-111/bin/openspec.js'),
} satisfies Record<PinnedOpenspecV11Version, string>

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
  version: PinnedOpenspecV11Version,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<CliRunResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [PINNED_V11_BINS[version], ...args],
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
  version: PinnedOpenspecV11Version,
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const result = await runPinnedOpenspec(version, ['--version'], cwd, env)
  expect(result.exitCode, result.stdout + '\n' + result.stderr).toBe(0)
  expect(result.stdout.trim()).toBe(version)
}

/**
 * Assert the 1.10/1.11 JSON stream discipline on one `--json` run.
 *
 * Upstream moved the first-run telemetry notice and the completions tip to stderr and
 * defers both on JSON runs, so an admitted JSON invocation must leave stdout as exactly
 * one complete JSON document and stderr free of telemetry/tip noise. This is fixture
 * evidence for the eager-JSON fast path, which must keep refusing early exit while
 * stderr carries real diagnostics; it does not license ignoring stderr generally.
 */
export function expectPinnedJsonDiscipline(result: CliRunResult): void {
  // A JSON run prints exactly one document on stdout; `schemas --json` success is an
  // array while most commands print an object, so either top-level shape is valid.
  let parsed: unknown
  try {
    parsed = JSON.parse(result.stdout)
  } catch (error) {
    expect.fail(
      `stdout is not one complete JSON document: ${result.stdout.slice(0, 200)}\n${result.stderr}`,
      String(error)
    )
  }
  expect(
    (typeof parsed === 'object' && parsed !== null) || Array.isArray(parsed),
    result.stdout.slice(0, 200)
  ).toBe(true)
  expect(result.stderr, 'JSON runs must not emit telemetry or completion-tip noise').not.toMatch(
    /telemetry|completions|tip/i
  )
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
