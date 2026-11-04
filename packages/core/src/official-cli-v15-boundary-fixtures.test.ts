/**
 * Orthogonal intents (updated 2026-11-04 Asia/Shanghai):
 * 1. Prove the executable identity of the retired boundary line: the kept
 *    `openspec-cli-115` npm alias prints exactly 1.15.0 — the just-retired line the v16
 *    gate revoked (below-admitted for the `>=1.16.0 <1.17.0` window).
 * 2. Prove the production v16 gate classifies 1.15.0 as `unsupported`, so the
 *    single-series window cannot silently re-admit the v15 line.
 * 3. Record the 1.16-only config-error gate as absent on the boundary executable over the
 *    same initialized fixture repo the admitted line reads: with a structurally invalid
 *    `openspec/config.yaml`, 1.16.0 fails `validate --all --json` at exit 1 with a
 *    `status`-only envelope whose `code` is `unparseable_config`, while 1.15.0 answers
 *    the ordinary report (`items`/`summary`/`root`/`version`) at exit 0. This is the
 *    CI-visible gate upstream #1892 added; the boundary proves what 1.16 added, never
 *    that a v15-era member disappeared.
 * 4. Never claim the 1.15 surfaces (`update --dry-run`, `install`) as v16
 *    discriminators: the boundary executable ships both (verified on the real binary),
 *    so an absence assertion there would be a fabrication.
 *
 * Original request (2026-11-04): "后每隔 3 天检查一下有没有需要更新的，然后更近更新。按照标准工作流推进上线。"
 *   — update-openspec-cli-16-line Slice 2 rewrites this suite as the v15 boundary for
 *   the v16 line: the v14 helper and its 1.14.3 boundary role retire, the kept
 *   `openspec-cli-115` executable becomes the boundary service, the 1.15-only absence
 *   probes are deleted (both surfaces exist on 1.15.0), and the unparseable-config
 *   `validate` gate becomes the executable discriminator.
 * Original request (2026-10-25): "开工"
 *   — target-openspec-cli-15-line Slice 3 rotated this suite to the 1.14.3 boundary
 *   (kept v14 helper) with 1.15-only surface absence checks. Retained as history.
 */
import { execFile } from 'node:child_process'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v16-fixtures.js'
import { CliDiagnosticFailureSchema } from './cli-contracts/common.js'
import { CliValidateReportSchema } from './cli-contracts/workflow.js'
import { classifyOpenSpecCliVersion } from './openspec-compat.js'

/** The retired below-admitted boundary executable kept through the openspec-cli-115 alias. */
const RETIRED_V15_BIN = resolve(
  import.meta.dirname,
  '../node_modules/openspec-cli-115/bin/openspec.js'
)

interface BoundaryRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

function runRetiredV15Openspec(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<BoundaryRunResult> {
  return new Promise((complete) => {
    execFile(
      process.execPath,
      [RETIRED_V15_BIN, ...args],
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

describe('pinned OpenSpec 1.15 boundary fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  it('prints the exact line identity for the boundary executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-115-boundary-identity')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // Exact equality, never a prefix: the provenance guard must fail if the alias ever
    // resolves to another 1.15 patch or to the admitted 1.16.0 line.
    const version = await runRetiredV15Openspec(['--version'], project, env)
    expect(version.exitCode, version.stdout + '\n' + version.stderr).toBe(0)
    expect(version.stdout.trim()).toBe('1.15.0')
  }, 60_000)

  it('classifies the retired 1.15.0 line as unsupported under the v16 gate', () => {
    const compatibility = classifyOpenSpecCliVersion('1.15.0')
    expect(compatibility.status).toBe('unsupported')
    expect(compatibility.supported).toBe(false)
    expect(compatibility.recommended).toBe(false)
  })

  it('keeps the 1.16-only unparseable-config gate absent on the boundary executable', async () => {
    fixtureRoot = await createPinnedFixtureRoot('cli-115-boundary-config-gate')
    const project = join(fixtureRoot, 'project')
    const env = pinnedFixtureEnv(fixtureRoot)
    await mkdir(project, { recursive: true })

    // Both executables read the same initialized repo. Initialization is a precondition,
    // not setup sugar: without an admitted root (no `openspec/specs` or
    // `openspec/changes`) root resolution fails first and *both* lines answer the same
    // `invalid_store_pointer` envelope, which would erase the discriminator.
    const initialized = await runPinnedOpenspec(
      '1.16.0',
      ['init', project, '--tools=none'],
      project,
      env
    )
    expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

    // A structurally invalid project config (unclosed flow sequence).
    await writeFile(join(project, 'openspec', 'config.yaml'), 'schema: [unclosed\n')

    // 1.16.0: the CI-visible config gate answers one `status` document and exits 1.
    const admitted = await runPinnedOpenspec(
      '1.16.0',
      ['validate', '--all', '--json'],
      project,
      env
    )
    expect(admitted.exitCode, admitted.stdout + '\n' + admitted.stderr).toBe(1)
    expectPinnedJsonDiscipline(admitted)
    const admittedPayload = JSON.parse(admitted.stdout)
    // "Only `status`": the whole report shape must be absent, not merely empty.
    expect(Object.keys(admittedPayload)).toEqual(['status'])
    const admittedFailure = CliDiagnosticFailureSchema.parse(admittedPayload)
    expect(admittedFailure.status.map((entry) => entry.code)).toEqual(['unparseable_config'])
    expect(admittedFailure.status[0]?.severity).toBe('error')
    expect(admittedFailure.status[0]?.message).toContain('openspec/config.yaml')

    // 1.15.0: the same repo answers the ordinary report (no config gate) and exits 0.
    const boundary = await runRetiredV15Openspec(['validate', '--all', '--json'], project, env)
    expect(boundary.exitCode, boundary.stdout + '\n' + boundary.stderr).toBe(0)
    const boundaryPayload = JSON.parse(boundary.stdout)
    expect(boundaryPayload).not.toHaveProperty('status')
    expect(Object.keys(boundaryPayload).sort()).toEqual(['items', 'root', 'summary', 'version'])
    const boundaryReport = CliValidateReportSchema.parse(boundaryPayload)
    expect(boundaryReport.items).toEqual([])
    expect(boundaryReport.summary.totals).toMatchObject({ items: 0, failed: 0 })
    expect(boundaryReport.root.path).toBe(await realpath(project))
  }, 60_000)
})
