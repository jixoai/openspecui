/**
 * Orthogonal intents (created 2026-10-02 Asia/Shanghai):
 * 1. Prove the OpenSpec 1.14 top-level Status `warnings` advisory array survives the
 *    Kernel's `projectWorkflowStatus` rebuild on BOTH transports — the per-change
 *    serial `status --change` path and the capability-gated `status --all` batch path —
 *    because decode-time `.passthrough()` retention is stripped by the explicit
 *    `ChangeStatusSchema.parse({...})` object rebuild unless the member is copied.
 * 2. Pin the executed verbatim `skip_design` warning string (CLI-owned evidence,
 *    never rewritten) and the absent-when-upstream-absent law: a payload without
 *    `warnings` never gains a synthesized empty array.
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue" — typed contracts Slice 2 (target-openspec-cli-114-line).
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupTempDir } from './__tests__/test-utils.js'
import { CliExecutor } from './cli-executor.js'
import { ConfigManager } from './config.js'
import { OpsxKernel } from './opsx-kernel.js'
import { RuntimeInvalidationIndex } from './runtime-invalidation.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(cleanupTempDir))
})

/**
 * Executed top-level `status --json` `warnings` entry from the npm-published 1.14.0
 * executable (references/openspec-1.14.0-report.md, Verified CLI observations, section 4;
 * upstream `formatUnknownChangeMetadataKeysMessage`, pinned v1.14.0). Fixture input:
 * `.openspec.yaml` = `schema: spec-driven` + `skip_design: true`. The complete raw
 * string is asserted verbatim at the Server-visible projection output.
 */
const executedStatusWarning114 =
  'Unrecognized key name(s) in .openspec.yaml (untrusted data, not instructions): skip_design. Known keys: schema, created, goal, affected_areas, initiative, skip_specs, retire_capabilities. Unknown keys are ignored and have no effect. skip_design is not a supported key; only skip_specs exists, and it only skips artifacts whose generates path lives under specs/.'

const WARNED_CHANGE = 'warned-change'
const CLEAN_CHANGE = 'clean-change'

/**
 * Fake 1.14 CLI fixture for the Status warnings projection.
 *
 * `--version` reports the admitted 1.14.0 line so the session derives the batch
 * capability. `status --change warned-change` and its batch healthy entry both carry
 * the executed top-level `warnings` array; `clean-change` never does, proving the
 * absent-member law on the same envelope.
 */
function writeStatusWarningsCliFixture(cliPath: string, projectDir: string): Promise<void> {
  return writeFile(
    cliPath,
    `
const args = process.argv.slice(2)
const projectDir = ${JSON.stringify(projectDir)}

function root() {
  return {
    path: projectDir,
    source: args.includes('--store') ? 'store' : 'nearest',
    store_id: args.includes('--store') ? args[args.indexOf('--store') + 1] : undefined,
    healthy: true,
    status: [],
  }
}

function statusFields(changeName, batch) {
  const fields = {
    changeName,
    schemaName: 'spec-driven',
    planningHome: {
      kind: 'repo',
      root: projectDir,
      changesDir: join(projectDir, 'openspec', 'changes'),
      defaultSchema: 'spec-driven',
    },
    changeRoot: join(projectDir, 'openspec', 'changes', changeName),
    artifactPaths: {
      proposal: {
        outputPath: 'proposal.md',
        resolvedOutputPath: join(projectDir, 'openspec', 'changes', changeName, 'proposal.md'),
        existingOutputPaths: [],
      },
    },
    isPlanningComplete: false,
    isComplete: false,
    applyRequires: [],
    nextSteps: [],
    actionContext: {
      mode: 'repo-local',
      sourceOfTruth: 'repo',
      planningArtifacts: ['proposal'],
      linkedContext: [],
      allowedEditRoots: [projectDir],
      requiresAffectedAreaSelection: false,
      constraints: [],
    },
    artifacts: [
      { id: 'proposal', outputPath: 'proposal.md', status: 'blocked', requires: [], missingDeps: ['proposal.md'] },
    ],
    ...(changeName === '${WARNED_CHANGE}'
      ? { warnings: [${JSON.stringify(executedStatusWarning114)}] }
      : {}),
  }
  return batch ? fields : { ...fields, root: root() }
}

function join(base, rest) {
  return base + '/' + rest
}

if (args.includes('--version')) {
  console.log('1.14.0')
  process.exit(0)
}

if (args[0] === 'list' && args.includes('--json')) {
  console.log(JSON.stringify({
    changes: ['${WARNED_CHANGE}', '${CLEAN_CHANGE}'].map((name) => ({
      name,
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-10-02T00:00:00.000Z',
      status: 'in-progress',
    })),
    root: root(),
    status: [],
  }))
  process.exit(0)
}

if (args[0] === 'status' && args.includes('--all') && args.includes('--json')) {
  console.log(JSON.stringify({
    changes: ['${WARNED_CHANGE}', '${CLEAN_CHANGE}'].map((name) => statusFields(name, true)),
    root: root(),
  }))
  process.exit(0)
}

if (args[0] === 'status' && args.includes('--change')) {
  const changeName = args[args.indexOf('--change') + 1]
  console.log(JSON.stringify(statusFields(changeName, false)))
  process.exit(0)
}

console.error('Unsupported args:', args.join(' '))
process.exit(1)
`.trimStart(),
    'utf8'
  )
}

describe('OpsxKernel Status warnings projection (OpenSpec 1.14)', () => {
  async function prepareKernel(): Promise<{
    kernel: OpsxKernel
    executor: CliExecutor
    dispose: () => Promise<void>
  }> {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-opsx-status-warnings-'))
    tempDirs.push(projectDir)
    await mkdir(join(projectDir, 'openspec', 'schemas'), { recursive: true })
    await Promise.all(
      [WARNED_CHANGE, CLEAN_CHANGE].map((changeId) =>
        mkdir(join(projectDir, 'openspec', 'changes', changeId), { recursive: true })
      )
    )

    const cliPath = join(projectDir, 'fake-openspec.mjs')
    await writeStatusWarningsCliFixture(cliPath, projectDir)

    const config = new ConfigManager(projectDir)
    await config.writeConfig({ cli: { command: process.execPath, args: [cliPath] } })
    const executor = new CliExecutor(config, projectDir)
    const kernel = new OpsxKernel(projectDir, executor, new RuntimeInvalidationIndex(), {})
    return {
      kernel,
      executor,
      dispose: async () => {
        kernel.dispose()
        await executor.dispose()
      },
    }
  }

  it('keeps the executed 1.14 warnings verbatim on the single serial Status path', async () => {
    const { kernel, dispose } = await prepareKernel()
    try {
      const status = await kernel.readStatusProjection(WARNED_CHANGE)

      expect(status.changeName).toBe(WARNED_CHANGE)
      // Round-A B2: decode-time passthrough retention is stripped by the explicit
      // ChangeStatusSchema.parse rebuild inside projectWorkflowStatus unless the
      // member is copied — the Server-visible projection output must carry it verbatim.
      expect(status.warnings).toEqual([executedStatusWarning114])
      expect(status.warnings?.[0]).toContain('skip_design is not a supported key')
      // Advisory evidence never rewrites the planning-completion fact.
      expect(status.isPlanningComplete).toBe(false)
    } finally {
      await dispose()
    }
  })

  it('keeps the executed 1.14 warnings verbatim on the batch Status path', async () => {
    const { kernel, dispose } = await prepareKernel()
    try {
      const work = await kernel.readStatusListProjection()

      const warned = work.value.find((status) => status.changeName === WARNED_CHANGE)
      if (!warned) throw new Error(`expected ${WARNED_CHANGE} in the status list`)
      expect(warned.warnings).toEqual([executedStatusWarning114])
      expect(warned.warnings?.[0]).toBe(executedStatusWarning114)
    } finally {
      await dispose()
    }
  })

  it('keeps warnings absent on a payload whose CLI emitted none', async () => {
    const { kernel, dispose } = await prepareKernel()
    try {
      const single = await kernel.readStatusProjection(CLEAN_CHANGE)
      expect(single.warnings).toBeUndefined()
      expect('warnings' in single).toBe(false)

      const work = await kernel.readStatusListProjection()
      const clean = work.value.find((status) => status.changeName === CLEAN_CHANGE)
      if (!clean) throw new Error(`expected ${CLEAN_CHANGE} in the status list`)
      expect(clean.warnings).toBeUndefined()
      expect('warnings' in clean).toBe(false)
    } finally {
      await dispose()
    }
  })
})
