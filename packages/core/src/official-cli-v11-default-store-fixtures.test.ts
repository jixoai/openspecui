/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.10.0 and 1.11.0 CLIs against machine `defaultStore`
 *    root selection.
 * 2. Prove effective, absent, and stale fallback outcomes preserve upstream provenance
 *    and fixes on both admitted lines.
 * 3. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console
 *    execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-01): adapt OpenSpec 1.7 machine `defaultStore` without fabricating effective Root truth.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
 */
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V11_VERSIONS,
  createPinnedFixtureRoot,
  parsePinnedJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v11-fixtures.js'
import { CliDiagnosticFailureSchema } from './cli-contracts/common.js'
import { CliContextSchema, CliDoctorSchema } from './cli-contracts/store.js'

describe('pinned OpenSpec 1.10/1.11 defaultStore fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V11_VERSIONS) {
    it(`reports global_default only when the configured Store is selected effectively on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-default-store`)
      const storeRoot = join(fixtureRoot, 'team-context')
      const scratch = join(fixtureRoot, 'scratch')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(join(storeRoot, 'openspec', 'specs'), { recursive: true })
      await mkdir(join(storeRoot, 'openspec', 'changes', 'archive'), { recursive: true })
      await mkdir(scratch, { recursive: true })
      await writeFile(join(storeRoot, 'openspec', 'config.yaml'), 'schema: spec-driven\n')
      const physicalStoreRoot = await realpath(storeRoot)

      const registered = await runPinnedOpenspec(
        version,
        ['store', 'register', storeRoot, '--id', 'team-context', '--yes', '--json'],
        scratch,
        env
      )
      expect(registered.exitCode, registered.stdout + registered.stderr).toBe(0)
      const configured = await runPinnedOpenspec(
        version,
        ['config', 'set', 'defaultStore', 'team-context', '--string'],
        scratch,
        env
      )
      expect(configured.exitCode, configured.stdout + configured.stderr).toBe(0)

      const doctorResult = await runPinnedOpenspec(version, ['doctor', '--json'], scratch, env)
      expect(doctorResult.exitCode, doctorResult.stdout + doctorResult.stderr).toBe(0)
      expect(
        parsePinnedJson(doctorResult, (payload) => CliDoctorSchema.parse(payload)).root
      ).toMatchObject({
        path: physicalStoreRoot,
        source: 'global_default',
        store_id: 'team-context',
      })

      const contextResult = await runPinnedOpenspec(version, ['context', '--json'], scratch, env)
      expect(contextResult.exitCode, contextResult.stdout + contextResult.stderr).toBe(0)
      expect(
        parsePinnedJson(contextResult, (payload) => CliContextSchema.parse(payload)).root
      ).toMatchObject({
        path: physicalStoreRoot,
        source: 'global_default',
        store_id: 'team-context',
      })
    }, 60_000)

    it(`keeps absent and stale fallback failures distinct on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-default-store`)
      const scratch = join(fixtureRoot, 'scratch')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(scratch, { recursive: true })

      const absent = await runPinnedOpenspec(version, ['doctor', '--json'], scratch, env)
      expect(absent.exitCode).toBe(1)
      expect(
        parsePinnedJson(absent, (payload) => CliDiagnosticFailureSchema.parse(payload)).status[0]
          ?.code
      ).toBe('no_openspec_root')

      const configured = await runPinnedOpenspec(
        version,
        ['config', 'set', 'defaultStore', 'ghost-plans', '--string'],
        scratch,
        env
      )
      expect(configured.exitCode, configured.stdout + configured.stderr).toBe(0)
      const stale = await runPinnedOpenspec(version, ['doctor', '--json'], scratch, env)
      expect(stale.exitCode).toBe(1)
      expect(
        parsePinnedJson(stale, (payload) => CliDiagnosticFailureSchema.parse(payload)).status[0]
      ).toMatchObject({
        code: 'no_registered_stores',
        message: expect.stringContaining("Global defaultStore 'ghost-plans'"),
        fix: expect.stringContaining('openspec config unset defaultStore'),
      })
    }, 60_000)
  }
})
