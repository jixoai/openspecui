/**
 * Orthogonal intents (created 2026-09-12 Asia/Shanghai):
 * 1. Run the pinned OpenSpec 1.13.0 npm executable for the v13 fixture matrix (the retired
 *    1.12.0 line stays with the v12 helper for boundary negatives).
 * 2. Share one isolated fixture environment and hidden-console runner across fixture files.
 * 3. Keep fixture identity explicit so a passing matrix always names its executable line.
 * 4. Assert the 1.13 JSON stream discipline.
 *
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect } from 'vitest'

/** OpenSpec CLI line admitted by the OpenSpecUI 13 compatibility law (single-series window). */
export const PINNED_OPENSPEC_V13_VERSIONS = ['1.13.0'] as const

export type PinnedOpenspecV13Version = (typeof PINNED_OPENSPEC_V13_VERSIONS)[number]

const PINNED_V13_BINS = {
  '1.13.0': resolve(import.meta.dirname, '../../node_modules/openspec-cli-113/bin/openspec.js'),
} satisfies Record<PinnedOpenspecV13Version, string>

export interface CliRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Isolated machine fixture environment: no shared HOME, config, data, state, or cache.
 *
 * Both XDG_CONFIG_HOME and XDG_DATA_HOME must stay inside the fixture root: config owns
 * machine-global profile selection and data owns the Store registry/user schemas, so a
 * leaked machine profile would change 1.13 Agent artifact counts (the isolated default
 * core profile generates 6 skills + 6 commands; wider custom profiles generate more).
 */
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
  version: PinnedOpenspecV13Version,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<CliRunResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [PINNED_V13_BINS[version], ...args],
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

/**
 * Assert the executable line identity before any contract assertion uses it.
 *
 * This is the provenance guard: a bins-map entry accidentally pointing at another alias
 * (for example openspec-cli-112) prints a different `--version` string and fails here,
 * so a passing matrix always proves it ran the 1.13.0 line.
 */
export async function expectPinnedVersion(
  version: PinnedOpenspecV13Version,
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const result = await runPinnedOpenspec(version, ['--version'], cwd, env)
  expect(result.exitCode, result.stdout + '\n' + result.stderr).toBe(0)
  expect(result.stdout.trim()).toBe(version)
}

/**
 * Assert the 1.13 JSON stream discipline on one `--json` run.
 *
 * The 1.13 line keeps the discipline proven for admitted lines since the eager-JSON fast
 * path: a JSON invocation must leave stdout as exactly one complete JSON document and
 * stderr free of telemetry/tip noise. This remains fixture evidence for the eager-JSON
 * fast path, which must keep refusing early exit while stderr carries real diagnostics;
 * it does not license ignoring stderr generally.
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
