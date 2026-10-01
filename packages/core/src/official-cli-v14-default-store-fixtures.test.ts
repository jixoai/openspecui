/**
 * Orthogonal intents (updated 2026-10-02 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.14.0 CLI against machine `defaultStore` root
 *    selection.
 * 2. Prove effective, absent, and stale fallback outcomes preserve upstream provenance
 *    and fixes on the v14 single-series window.
 * 3. Carry over the admitted-line defaultStore contract proven for 1.10-1.13; hide
 *    fixture subprocess console windows (`windowsHide`) for uniform hidden-console
 *    execution on Windows.
 * 4. (2026-10-02, target-openspec-cli-114-line Slice 5) Prove the 1.14 store-backed
 *    `status` edit-roots dual branch (upstream #2013 `findDeclaringProjectRoot`): with
 *    the declaring project on the current path, `allowedEditRoots` is
 *    `[implementationRoot, projectRoot]` with the declaring-repo constraint; without
 *    one, `[projectRoot]` with the ask-user constraint; the non-store repo-local
 *    contrast keeps its single-root constraint. Same array shape, changed semantics —
 *    per `references/openspec-1.14.0-report.md` section 6.
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-01): adapt OpenSpec 1.7 machine `defaultStore` without fabricating effective Root truth.
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
 */
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PINNED_OPENSPEC_V14_VERSIONS,
  createPinnedFixtureRoot,
  expectPinnedJsonDiscipline,
  parsePinnedJson,
  parsePinnedSuccessJson,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v14-fixtures.js'
import { CliDiagnosticFailureSchema } from './cli-contracts/common.js'
import { CliContextSchema, CliDoctorSchema } from './cli-contracts/store.js'
import { CliWorkflowStatusSuccessSchema } from './cli-contracts/workflow.js'

describe('pinned OpenSpec 1.14 defaultStore fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V14_VERSIONS) {
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
      expectPinnedJsonDiscipline(doctorResult)
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

    it(`names the declaring project in store-backed status edit roots on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-edit-roots`)
      const storeRoot = join(fixtureRoot, 'team-store')
      const declaringProject = join(fixtureRoot, 'declaring-project')
      const scratch = join(fixtureRoot, 'scratch')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(join(storeRoot, 'openspec', 'specs'), { recursive: true })
      await mkdir(join(storeRoot, 'openspec', 'changes', 'archive'), { recursive: true })
      await writeFile(join(storeRoot, 'openspec', 'config.yaml'), 'schema: spec-driven\n')
      // A config-only pointer root (no planning shape) is the declaring project.
      await mkdir(join(declaringProject, 'openspec'), { recursive: true })
      await writeFile(join(declaringProject, 'openspec', 'config.yaml'), 'store: team-context\n')
      await mkdir(scratch, { recursive: true })
      const physicalStoreRoot = await realpath(storeRoot)
      const physicalDeclaringRoot = await realpath(declaringProject)

      const registered = await runPinnedOpenspec(
        version,
        ['store', 'register', storeRoot, '--id', 'team-context', '--yes', '--json'],
        scratch,
        env
      )
      expect(registered.exitCode, registered.stdout + registered.stderr).toBe(0)

      // The change lives in the store itself, so only the current-path declaring
      // pointer can distinguish the two branches.
      const changeDir = join(storeRoot, 'openspec', 'changes', 'store-change')
      await mkdir(changeDir, { recursive: true })
      await writeFile(join(changeDir, '.openspec.yaml'), 'schema: spec-driven\n')
      await writeFile(join(changeDir, 'proposal.md'), '# Proposal\n\nStore-backed change.\n')

      // Branch 1 — declaring project on the current path: implementation edits are
      // routed to the declaring repo, which joins the store in allowedEditRoots
      // (implementation first, then the planning store).
      const fromDeclaring = await runPinnedOpenspec(
        version,
        ['status', '--change', 'store-change', '--store', 'team-context', '--json'],
        declaringProject,
        env
      )
      expectPinnedJsonDiscipline(fromDeclaring)
      const declaring = parsePinnedSuccessJson(fromDeclaring, (payload) =>
        CliWorkflowStatusSuccessSchema.parse(payload)
      )
      expect(declaring.root.store_id).toBe('team-context')
      expect(declaring.actionContext.allowedEditRoots).toEqual([
        physicalDeclaringRoot,
        physicalStoreRoot,
      ])
      expect(declaring.actionContext.constraints).toEqual([
        `Change artifacts live in store 'team-context' (${physicalStoreRoot}). ` +
          `Implementation edits go in ${physicalDeclaringRoot}, the project on the current path that declares this store; ` +
          'ask the user before editing any other repository.',
      ])

      // Branch 2 — no declaring project anywhere above the scratch cwd: the store
      // stays the only edit root and the guidance tells the agent to ask which
      // repository implements the change.
      const fromScratch = await runPinnedOpenspec(
        version,
        ['status', '--change', 'store-change', '--store', 'team-context', '--json'],
        scratch,
        env
      )
      expectPinnedJsonDiscipline(fromScratch)
      const storeOnly = parsePinnedSuccessJson(fromScratch, (payload) =>
        CliWorkflowStatusSuccessSchema.parse(payload)
      )
      expect(storeOnly.root.store_id).toBe('team-context')
      expect(storeOnly.actionContext.allowedEditRoots).toEqual([physicalStoreRoot])
      expect(storeOnly.actionContext.constraints).toEqual([
        `Change artifacts live in store 'team-context' (${physicalStoreRoot}). ` +
          'OpenSpec could not determine which repository implements this change; ' +
          'ask the user which repository to edit, and make implementation edits there.',
      ])
    }, 60_000)
  }
})
