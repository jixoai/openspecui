/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Prove the OpenSpec 1.16.0 project-config failure as an executable fact: a broken
 *    `openspec/config.yaml` makes `validate` answer a bare `{ status: [...] }` envelope at a
 *    non-zero exit, for both codes and for the findings transport.
 * 2. Prove a healthy project keeps the ordinary report and findings document shapes, so the
 *    new envelope is a distinct decode branch rather than a reshaped report.
 * 3. Keep the fixture initialized first: without `openspec init` both 1.16.0 and 1.15.0 answer
 *    the identical `invalid_store_pointer`, which would make the discriminator look
 *    non-discriminating.
 *
 * Original request (2026-11-04): "后每隔 3 天检查一下有没有需要更新的，然后更近更新。按照标准工作流推进上线。"
 *   — update-openspec-cli-16-line Slice 4.
 */
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V16_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  expectPinnedVersion,
  parsePinnedJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
  type PinnedOpenspecV16Version,
} from './__tests__/official-cli-v16-fixtures.js'
import { CliDiagnosticFailureSchema } from './cli-contracts/common.js'
import { CliValidateFindingsSchema, CliValidateReportSchema } from './cli-contracts/workflow.js'

const BROKEN_YAML = 'schema: [unclosed\n  bad: : :\n'

async function initProject(
  version: PinnedOpenspecV16Version,
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

describe('pinned OpenSpec 1.16 project-config failure fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V16_VERSIONS) {
    it(`fails bulk validation with the diagnostic envelope on a broken config on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-config-broken`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)
      await initProject(version, project, env)
      await writeFile(join(project, 'openspec', 'config.yaml'), BROKEN_YAML)

      const result = await runPinnedOpenspec(version, ['validate', '--all', '--json'], project, env)

      expect(result.exitCode).toBe(1)
      expectPinnedJsonDiscipline(result)
      const payload = JSON.parse(result.stdout) as Record<string, unknown>
      // The whole report shape is absent — this is not "a report with no items".
      expect(Object.keys(payload)).toEqual(['status'])
      expect(CliValidateReportSchema.safeParse(payload).success).toBe(false)

      const envelope = CliDiagnosticFailureSchema.parse(payload)
      expect(envelope.status[0]).toMatchObject({
        severity: 'error',
        code: 'unparseable_config',
      })
      expect(envelope.status[0]?.message).toContain(join(project, 'openspec', 'config.yaml'))
      expect(envelope.status[0]?.fix).toBeTruthy()
    }, 60_000)

    it(`answers the findings transport with the same envelope on a broken config on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-config-broken-findings`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)
      await writeFile(join(project, 'openspec', 'config.yaml'), BROKEN_YAML)

      const result = await runPinnedOpenspec(
        version,
        ['validate', '--all', '--report', 'findings', '--json'],
        project,
        env
      )

      expect(result.exitCode).toBe(1)
      const payload = JSON.parse(result.stdout) as Record<string, unknown>
      expect(Object.keys(payload)).toEqual(['status'])
      // Never the filtered findings document.
      expect(CliValidateFindingsSchema.safeParse(payload).success).toBe(false)
      expect(CliDiagnosticFailureSchema.parse(payload).status[0]).toMatchObject({
        code: 'unparseable_config',
      })
    }, 60_000)

    it(`reports an unreadable config with its own code on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-config-unreadable`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)
      const configPath = join(project, 'openspec', 'config.yaml')
      await chmod(configPath, 0o000)
      try {
        const result = await runPinnedOpenspec(version, ['validate', '--json'], project, env)

        expect(result.exitCode).toBe(1)
        const envelope = parsePinnedJson(result, (payload) =>
          CliDiagnosticFailureSchema.parse(payload)
        )
        expect(envelope.status[0]).toMatchObject({ code: 'unreadable_config' })
        expect(envelope.status[0]?.message).toContain(configPath)
      } finally {
        await chmod(configPath, 0o600)
      }
    }, 60_000)

    it(`keeps the report and findings shapes on a healthy project on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-config-healthy`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await initProject(version, project, env)

      const report = await runPinnedOpenspec(version, ['validate', '--all', '--json'], project, env)
      expectPinnedJsonDiscipline(report)
      const reportPayload = JSON.parse(report.stdout) as Record<string, unknown>
      expect(Object.keys(reportPayload).sort()).toEqual(['items', 'root', 'summary', 'version'])
      expect(CliValidateReportSchema.parse(reportPayload)).toBeTruthy()
      expect(CliDiagnosticFailureSchema.safeParse(reportPayload).success).toBe(false)

      const findings = await runPinnedOpenspec(
        version,
        ['validate', '--all', '--report', 'findings', '--json'],
        project,
        env
      )
      expectPinnedJsonDiscipline(findings)
      const findingsPayload = JSON.parse(findings.stdout) as Record<string, unknown>
      expect(Object.keys(findingsPayload).sort()).toEqual([
        'itemFindings',
        'report',
        'root',
        'summary',
      ])
      expect(CliValidateFindingsSchema.parse(findingsPayload)).toBeTruthy()
    }, 60_000)
  }
})
