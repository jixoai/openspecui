/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Prove OPSX Change enumeration comes from the executable typed OpenSpec CLI contract.
 * 2. Prove physical Change directories remain invalidation evidence rather than projected business truth.
 * 3. Preserve the exact Store-selected CLI payload and process evidence in the retained projection.
 * 4. Prove aggregate CLI projections submit entity work lazily instead of monopolizing admission.
 * 5. Preserve cross-platform schema-template paths in executable CLI fixtures.
 * 6. Prove the capability-gated OpenSpec 1.11 batch status transport replaces only the transport:
 *    one `status --all` spawn, per-change projections identical to the serial path, per-change
 *    failure entries kept as that change's evidence, and 1.10 sessions still on the serial path.
 * Original request (2026-08-05): "Continue the Windows adaptation and fix equivalent failures together."
 *
 * Original request (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。"
 * Original request (2026-07-31): "系统性地进行修复，因为List页面也有类似的问题。所有可能其它页面都有类似的问题。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir } from './__tests__/test-utils.js'
import { CliExecutor } from './cli-executor.js'
import { CliProjectionCommandError } from './cli-projection.js'
import { ConfigManager } from './config.js'
import { OpsxKernel } from './opsx-kernel.js'
import type { ChangeStatus } from './opsx-types.js'
import { RuntimeInvalidationIndex } from './runtime-invalidation.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(cleanupTempDir))
})

describe('OpsxKernel CLI Change-list projection', () => {
  it('projects the executable CLI list instead of the physical directory inventory', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-opsx-list-'))
    tempDirs.push(projectDir)
    await mkdir(join(projectDir, 'openspec', 'changes', 'physical-only'), { recursive: true })

    const cliPath = join(projectDir, 'fake-openspec.mjs')
    await writeFile(
      cliPath,
      `
const args = process.argv.slice(2)
if (args.includes('--version')) {
  console.log('1.6.0')
  process.exit(0)
}
if (args[0] !== 'list' || !args.includes('--json')) process.exit(2)
const storeIndex = args.indexOf('--store')
const storeId = storeIndex >= 0 ? args[storeIndex + 1] : undefined
console.log(JSON.stringify({
  changes: [{
    name: 'cli-owned',
    completedTasks: 1,
    totalTasks: 2,
    lastModified: '2026-07-27T00:00:00.000Z',
    status: 'in-progress',
  }],
  root: { path: process.cwd(), source: storeId ? 'store' : 'nearest', store_id: storeId },
  status: [],
}))
`.trimStart(),
      'utf8'
    )
    const config = new ConfigManager(projectDir)
    await config.writeConfig({ cli: { command: process.execPath, args: [cliPath] } })
    const kernel = new OpsxKernel(
      projectDir,
      new CliExecutor(config, projectDir),
      new RuntimeInvalidationIndex(),
      { store: 'shared' }
    )

    try {
      const projection = await kernel.readChangeListProjection()

      expect(projection.value).toEqual(['cli-owned'])
      expect(projection.value).not.toContain('physical-only')
      expect(projection.evidence).toMatchObject({
        success: true,
        stderr: '',
        exitCode: 0,
        payload: {
          changes: [{ name: 'cli-owned', completedTasks: 1, totalTasks: 2 }],
          root: { source: 'store', store_id: 'shared' },
        },
        diagnostics: [],
      })
      expect(projection.evidence.stdout).toContain('"cli-owned"')
    } finally {
      kernel.dispose()
    }
  })
})

describe('OpsxKernel typed Schema and Template projections', () => {
  it('uses checked executor data instead of the raw Schema and Template helpers', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-opsx-schema-contract-'))
    tempDirs.push(projectDir)
    const schemaDir = join(projectDir, 'openspec', 'schemas', 'contract-schema')
    await mkdir(join(schemaDir, 'templates'), { recursive: true })
    await writeFile(
      join(schemaDir, 'schema.yaml'),
      [
        'name: contract-schema',
        'artifacts:',
        '  - id: proposal',
        '    generates: proposal.md',
        '    template: proposal.md',
        '    requires: []',
      ].join('\n'),
      'utf8'
    )
    await writeFile(join(schemaDir, 'templates', 'proposal.md'), '# Proposal\n', 'utf8')

    const cliPath = join(projectDir, 'fake-openspec.mjs')
    await writeFile(
      cliPath,
      `
const args = process.argv.slice(2)
const schemaDir = ${JSON.stringify(schemaDir)}

if (args.includes('--version')) {
  console.log('1.6.0')
  process.exit(0)
}
if (args[0] === 'schemas' && args.includes('--json')) {
  console.log(JSON.stringify([{
    name: 'contract-schema',
    description: 'Checked CLI contract schema.',
    artifacts: ['proposal'],
    source: 'project',
  }]))
  process.exit(0)
}
if (args[0] === 'schema' && args[1] === 'which' && args.includes('--json')) {
  console.log(JSON.stringify({
    name: 'contract-schema',
    source: 'project',
    path: schemaDir,
    shadows: [],
  }))
  process.exit(0)
}
if (args[0] === 'templates' && args.includes('--json')) {
  console.log(JSON.stringify({
    proposal: {
      path: ${JSON.stringify(join(schemaDir, 'templates', 'proposal.md'))},
      source: 'project',
    },
  }))
  process.exit(0)
}
process.exit(2)
`.trimStart(),
      'utf8'
    )

    const config = new ConfigManager(projectDir)
    await config.writeConfig({ cli: { command: process.execPath, args: [cliPath] } })
    const executor = new CliExecutor(config, projectDir)
    const kernel = new OpsxKernel(projectDir, executor, new RuntimeInvalidationIndex(), {})
    const rawSchemas = vi
      .spyOn(executor, 'schemas')
      .mockRejectedValue(new Error('Kernel must not bypass contracts.schemas'))
    const rawSchemaWhich = vi
      .spyOn(executor, 'schemaWhich')
      .mockRejectedValue(new Error('Kernel must not bypass contracts.schemaWhich'))
    const rawTemplates = vi
      .spyOn(executor, 'templates')
      .mockRejectedValue(new Error('Kernel must not bypass contracts.templates'))
    const schemas = vi.spyOn(executor.contracts, 'schemas')
    const schemaWhich = vi.spyOn(executor.contracts, 'schemaWhich')
    const templates = vi.spyOn(executor.contracts, 'templates')

    try {
      const bundle = await kernel.readConfigBundleProjection()
      const templateProjection = await kernel.readTemplatesProjection('contract-schema')

      expect(bundle.value.schemas).toEqual([
        {
          name: 'contract-schema',
          description: 'Checked CLI contract schema.',
          artifacts: ['proposal'],
          source: 'project',
        },
      ])
      expect(bundle.value.schemaResolutions['contract-schema']).toMatchObject({
        path: schemaDir,
        displayPath: 'project:openspec/schemas/contract-schema',
      })
      expect(templateProjection.value).toEqual({
        proposal: {
          path: join(schemaDir, 'templates', 'proposal.md'),
          displayPath: 'project:openspec/schemas/contract-schema/templates/proposal.md',
          source: 'project',
        },
      })
      expect(templateProjection.evidence).toMatchObject({
        success: true,
        stderr: '',
        exitCode: 0,
        payload: {
          proposal: {
            path: join(schemaDir, 'templates', 'proposal.md'),
            source: 'project',
          },
        },
        diagnostics: [],
      })
      expect(templateProjection.evidence.stdout).toContain('proposal.md')
      expect(schemas).toHaveBeenCalledOnce()
      expect(schemaWhich).toHaveBeenCalledWith('contract-schema')
      expect(templates).toHaveBeenCalledWith('contract-schema')
      expect(rawSchemas).not.toHaveBeenCalled()
      expect(rawSchemaWhich).not.toHaveBeenCalled()
      expect(rawTemplates).not.toHaveBeenCalled()
    } finally {
      kernel.dispose()
    }
  })
})

describe('OpsxKernel aggregate CLI admission', () => {
  it('submits Status reads lazily so later critical CLI work can enter between entities', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-opsx-status-admission-'))
    tempDirs.push(projectDir)
    const changes = ['change-a', 'change-b', 'change-c']
    await mkdir(join(projectDir, 'openspec', 'schemas'), { recursive: true })
    await Promise.all(
      changes.map((changeId) =>
        mkdir(join(projectDir, 'openspec', 'changes', changeId), { recursive: true })
      )
    )

    const cliPath = join(projectDir, 'fake-openspec.mjs')
    await writeFile(
      cliPath,
      `
const args = process.argv.slice(2)
const projectDir = ${JSON.stringify(projectDir)}
const changes = ${JSON.stringify(changes)}
if (args.includes('--version')) {
  console.log('1.6.0')
  process.exit(0)
}
if (args[0] === 'list' && args.includes('--json')) {
  console.log(JSON.stringify({
    changes: changes.map((name) => ({
      name,
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-07-31T00:00:00.000Z',
      status: 'in-progress',
    })),
    root: { path: projectDir, source: 'nearest' },
    status: [],
  }))
  process.exit(0)
}
if (args[0] === 'status' && args.includes('--json')) {
  const changeName = args[args.indexOf('--change') + 1]
  console.log(JSON.stringify({
    changeName,
    schemaName: 'spec-driven',
    planningHome: {
      kind: 'repo',
      root: projectDir,
      changesDir: projectDir + '/openspec/changes',
      defaultSchema: 'spec-driven',
    },
    changeRoot: projectDir + '/openspec/changes/' + changeName,
    artifactPaths: {},
    isPlanningComplete: false,
    isComplete: false,
    applyRequires: [],
    nextSteps: [],
    actionContext: {
      mode: 'repo-local',
      sourceOfTruth: 'repo',
      planningArtifacts: [],
      linkedContext: [],
      allowedEditRoots: [],
      requiresAffectedAreaSelection: false,
      constraints: [],
    },
    artifacts: [],
    root: { path: projectDir, source: 'nearest' },
  }))
  process.exit(0)
}
process.exit(2)
`.trimStart(),
      'utf8'
    )

    const config = new ConfigManager(projectDir)
    await config.writeConfig({ cli: { command: process.execPath, args: [cliPath] } })
    const executor = new CliExecutor(config, projectDir)
    const kernel = new OpsxKernel(projectDir, executor, new RuntimeInvalidationIndex(), {})
    const executeStatus = executor.contracts.workflowStatus.bind(executor.contracts)
    let activeStatusCalls = 0
    let peakActiveStatusCalls = 0
    vi.spyOn(executor.contracts, 'workflowStatus').mockImplementation(async (...args) => {
      activeStatusCalls += 1
      peakActiveStatusCalls = Math.max(peakActiveStatusCalls, activeStatusCalls)
      try {
        return await executeStatus(...args)
      } finally {
        activeStatusCalls -= 1
      }
    })

    try {
      const projection = await kernel.readStatusListProjection()

      expect(projection.value.map((status) => status.changeName)).toEqual(changes)
      expect(peakActiveStatusCalls).toBe(1)
    } finally {
      kernel.dispose()
      await executor.dispose()
    }
  })
})

const BATCH_STATUS_CHANGES = ['change-a', 'change-b', 'change-c']

/**
 * Fake admitted CLI fixture for the capability-gated batch status transport.
 *
 * Every invocation argv is appended to `cli-invocations.log` so tests assert real spawn
 * argv, not spy calls. `--version` selects the admitted series (1.11.0 selects the batch
 * capability; 1.10.0 does not). Marker files switch the fixture scenario:
 * - `fail-change-b`: the batch envelope carries a per-change failure entry for change-b
 *   (exit 1) and the serial per-change command fails with diagnostics + stderr + exit 7.
 * - `batch-garbage`: `status --all` prints a non-JSON document (transport failure).
 * - `batch-root-failure`: `status --all` prints the root-selection null shape (exit 1).
 * Serial `status --change <id>` and batch healthy entries derive from one shared field
 * builder so both transports publish identical per-change Status payloads.
 */
function writeBatchStatusCliFixture(
  cliPath: string,
  projectDir: string,
  version: '1.10.0' | '1.11.0'
): Promise<void> {
  return writeFile(
    cliPath,
    `
import { appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const projectDir = ${JSON.stringify(projectDir)}
const version = ${JSON.stringify(version)}
const changes = ${JSON.stringify(BATCH_STATUS_CHANGES)}
const logPath = join(projectDir, 'cli-invocations.log')

appendFileSync(logPath, JSON.stringify(args) + '\\n')

function marker(name) {
  return existsSync(join(projectDir, name))
}

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
  const done = changeName === 'change-c'
  const changeRoot = join(projectDir, 'openspec', 'changes', changeName)
  const resolved = join(changeRoot, 'proposal.md')
  const fields = {
    changeName,
    schemaName: 'spec-driven',
    planningHome: {
      kind: 'repo',
      root: projectDir,
      changesDir: join(projectDir, 'openspec', 'changes'),
      defaultSchema: 'spec-driven',
    },
    changeRoot,
    artifactPaths: {
      proposal: {
        outputPath: 'proposal.md',
        resolvedOutputPath: resolved,
        existingOutputPaths: done ? [resolved] : [],
      },
    },
    isPlanningComplete: done,
    isComplete: done,
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
      {
        id: 'proposal',
        outputPath: 'proposal.md',
        status: done ? 'done' : 'blocked',
        requires: [],
        missingDeps: done ? [] : ['proposal.md'],
      },
    ],
  }
  return batch ? fields : { ...fields, root: root() }
}

if (args.includes('--version')) {
  console.log(version)
  process.exit(0)
}

if (args[0] === 'list' && args.includes('--json')) {
  console.log(JSON.stringify({
    changes: changes.map((name) => ({
      name,
      completedTasks: 0,
      totalTasks: 1,
      lastModified: '2026-08-28T00:00:00.000Z',
      status: 'in-progress',
    })),
    root: root(),
    status: [],
  }))
  process.exit(0)
}

if (args[0] === 'status' && args.includes('--all') && args.includes('--json')) {
  if (!version.startsWith('1.11')) {
    console.error('unknown option --all')
    process.exit(2)
  }
  if (marker('batch-garbage')) {
    console.log('this is not one JSON document')
    process.exit(1)
  }
  if (marker('batch-root-failure')) {
    console.log(JSON.stringify({
      changes: [],
      root: null,
      status: [
        { severity: 'error', code: 'root-selection', message: 'No openspec root found for status.' },
      ],
    }))
    process.exit(1)
  }
  const failB = marker('fail-change-b')
  const entries = changes.map((name) =>
    name === 'change-b' && failB
      ? {
          changeName: 'change-b',
          status: [
            {
              severity: 'error',
              code: 'change-load',
              message: "Change 'change-b' failed to load.",
            },
          ],
        }
      : statusFields(name, true)
  )
  console.log(JSON.stringify({ changes: entries, root: root() }))
  process.exit(failB ? 1 : 0)
}

if (args[0] === 'status' && args.includes('--change')) {
  const changeName = args[args.indexOf('--change') + 1]
  if (changeName === 'change-b' && marker('fail-change-b')) {
    console.log(JSON.stringify({
      status: [
        {
          severity: 'error',
          code: 'change-load',
          message: "Change 'change-b' failed to load.",
        },
      ],
    }))
    console.error('fixture per-change status stderr')
    process.exit(7)
  }
  console.log(JSON.stringify(statusFields(changeName, false)))
  process.exit(0)
}

console.error('Unsupported args:', args.join(' '))
process.exit(1)
`.trimStart(),
    'utf8'
  )
}

describe('OpsxKernel capability-gated batch status transport', () => {
  interface BatchFixture {
    kernel: OpsxKernel
    executor: CliExecutor
    projectDir: string
    readInvocations: () => string[][]
    dispose: () => Promise<void>
  }

  async function prepareBatchKernel(
    version: '1.10.0' | '1.11.0',
    markers: readonly string[] = []
  ): Promise<BatchFixture> {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-opsx-batch-status-'))
    tempDirs.push(projectDir)
    await mkdir(join(projectDir, 'openspec', 'schemas'), { recursive: true })
    await Promise.all(
      BATCH_STATUS_CHANGES.map((changeId) =>
        mkdir(join(projectDir, 'openspec', 'changes', changeId), { recursive: true })
      )
    )
    await writeFile(
      join(projectDir, 'openspec', 'changes', 'change-c', 'proposal.md'),
      '# Proposal\n',
      'utf8'
    )
    await Promise.all(markers.map((marker) => writeFile(join(projectDir, marker), '', 'utf8')))

    const cliPath = join(projectDir, 'fake-openspec.mjs')
    await writeBatchStatusCliFixture(cliPath, projectDir, version)
    const logPath = join(projectDir, 'cli-invocations.log')

    const config = new ConfigManager(projectDir)
    await config.writeConfig({ cli: { command: process.execPath, args: [cliPath] } })
    const executor = new CliExecutor(config, projectDir)
    const kernel = new OpsxKernel(projectDir, executor, new RuntimeInvalidationIndex(), {})
    return {
      kernel,
      executor,
      projectDir,
      readInvocations: () =>
        readFileSync(logPath, 'utf8')
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .map((line) => JSON.parse(line) as string[]),
      dispose: async () => {
        kernel.dispose()
        await executor.dispose()
      },
    }
  }

  function withoutStatusEvidence(status: ChangeStatus) {
    return { ...status, provenance: { ...status.provenance, evidence: undefined } }
  }

  /** Compare projections across two temp projects by erasing the differing absolute roots. */
  function normalizeStatusForCompare(status: ChangeStatus, projectDir: string) {
    return JSON.parse(
      JSON.stringify(withoutStatusEvidence(status)).split(projectDir).join('<project>')
    )
  }

  it('loads the status list with one status --all spawn and per-change projections identical to the serial transport', async () => {
    const batch = await prepareBatchKernel('1.11.0')
    const serial = await prepareBatchKernel('1.10.0')

    try {
      await batch.kernel.ensureStatusList()

      // One runner-resolution probe, one capability availability probe, then exactly one
      // status command: the batch spawn replaces every per-change status spawn.
      expect(batch.readInvocations()).toEqual([
        ['--version'],
        ['--version'],
        ['status', '--all', '--json'],
      ])
      const batchNames = batch.kernel.getStatusList().map((status) => status.changeName)
      expect([...batchNames].sort()).toEqual([...BATCH_STATUS_CHANGES].sort())

      await serial.kernel.ensureStatusList()
      expect(serial.readInvocations().some((argv) => argv.includes('--all'))).toBe(false)
      const serialNames = serial.kernel.getStatusList().map((status) => status.changeName)
      expect([...serialNames].sort()).toEqual([...BATCH_STATUS_CHANGES].sort())

      const byChangeName = (left: ChangeStatus, right: ChangeStatus) =>
        left.changeName.localeCompare(right.changeName)
      expect(
        batch.kernel
          .getStatusList()
          .sort(byChangeName)
          .map((status) => normalizeStatusForCompare(status, batch.projectDir))
      ).toEqual(
        serial.kernel
          .getStatusList()
          .sort(byChangeName)
          .map((status) => normalizeStatusForCompare(status, serial.projectDir))
      )

      const batchEvidence = batch.kernel.getStatus('change-a').provenance
      if (batchEvidence.kind !== 'cli') {
        throw new Error('Expected the batch status provenance to stay CLI-owned.')
      }
      expect(batchEvidence.evidence).toMatchObject({
        command: 'status',
        success: true,
        exitCode: 0,
        selector: {},
        root: { source: 'nearest' },
      })
      expect(batch.kernel.getStatus('change-c').isPlanningComplete).toBe(true)
      expect(batch.kernel.getStatus('change-a').artifacts[0]?.relativePath).toBe(
        'openspec/changes/change-a/proposal.md'
      )
    } finally {
      await batch.dispose()
      await serial.dispose()
    }
  })

  it('keeps a batch per-change failure entry as that change evidence without failing the status-list Work', { timeout: 20_000 }, async () => {
    const { kernel, readInvocations, dispose } = await prepareBatchKernel('1.11.0', [
      'fail-change-b',
    ])

    try {
      await expect(kernel.ensureStatusList()).resolves.toBeUndefined()

      const retainedNames = kernel.getStatusList().map((status) => status.changeName)
      expect(retainedNames).not.toContain('change-b')
      expect([...retainedNames].sort()).toEqual(['change-a', 'change-c'])

      // The serial per-change fallback runs only for the failed change, never for healthy ones.
      expect(
        readInvocations().filter((argv) => argv[0] === 'status' && argv.includes('--change'))
      ).toEqual([['status', '--change', 'change-b', '--json']])

      await expect(kernel.ensureStatus('change-b')).rejects.toMatchObject({
        name: 'CliProjectionCommandError',
        message: 'fixture per-change status stderr',
        cliEvidence: {
          success: false,
          exitCode: 7,
          stderr: 'fixture per-change status stderr\n',
          payload: {
            status: [
              {
                severity: 'error',
                code: 'change-load',
                message: "Change 'change-b' failed to load.",
              },
            ],
          },
        },
      })

      const work = await kernel.readStatusListProjection()
      expect(work.value.map((status) => status.changeName)).toEqual(['change-a', 'change-c'])
      expect(work.evidence.success).toBe(false)
      expect(work.evidence.exitCode).toBe(1)
      expect(work.evidence.payload).toMatchObject({
        changes: [
          { changeName: 'change-a' },
          {
            changeName: 'change-b',
            status: [
              {
                severity: 'error',
                code: 'change-load',
                message: "Change 'change-b' failed to load.",
              },
            ],
          },
          { changeName: 'change-c' },
        ],
      })
    } finally {
      await dispose()
    }
  })

  it('keeps the per-change serial transport when the batch capability is not admitted', async () => {
    const { kernel, readInvocations, dispose } = await prepareBatchKernel('1.10.0')

    try {
      const work = await kernel.readStatusListProjection()

      expect(work.value.map((status) => status.changeName)).toEqual(BATCH_STATUS_CHANGES)
      const invocations = readInvocations()
      expect(invocations.some((argv) => argv.includes('--all'))).toBe(false)
      expect(invocations.filter((argv) => argv[0] === 'status')).toEqual([
        ['status', '--change', 'change-a', '--json'],
        ['status', '--change', 'change-b', '--json'],
        ['status', '--change', 'change-c', '--json'],
      ])
      expect(work.evidence.payload).toMatchObject({
        changes: BATCH_STATUS_CHANGES.map((name) => ({ name })),
      })
    } finally {
      await dispose()
    }
  })

  it('keeps single-change status reads on the per-change transport under admitted 1.11 sessions', async () => {
    const { kernel, readInvocations, dispose } = await prepareBatchKernel('1.11.0')

    try {
      await kernel.ensureStatus('change-a')
      const status = await kernel.readStatusProjection('change-c')

      expect(status.changeName).toBe('change-c')
      expect(status.isPlanningComplete).toBe(true)
      expect(readInvocations()).toEqual([
        ['--version'],
        ['status', '--change', 'change-a', '--json'],
        ['status', '--change', 'change-c', '--json'],
      ])
    } finally {
      await dispose()
    }
  })

  it('routes batch transport and root-selection failures through the existing error paths', async () => {
    const garbage = await prepareBatchKernel('1.11.0', ['batch-garbage'])
    try {
      await expect(garbage.kernel.ensureStatusList()).rejects.toMatchObject({
        name: 'CliProjectionCommandError',
        message: expect.stringContaining('OpenSpec CLI stdout is not one JSON document'),
      })
    } finally {
      await garbage.dispose()
    }

    const rootFailure = await prepareBatchKernel('1.11.0', ['batch-root-failure'])
    try {
      await expect(rootFailure.kernel.ensureStatusList()).rejects.toMatchObject({
        name: 'CliProjectionCommandError',
        message: 'No openspec root found for status.',
        cliEvidence: {
          success: false,
          exitCode: 1,
          diagnostics: [
            {
              severity: 'error',
              code: 'root-selection',
              message: 'No openspec root found for status.',
            },
          ],
        },
      })
    } finally {
      await rootFailure.dispose()
    }
  })
})

describe('OpsxKernel schemas failure-envelope projection', () => {
  it('preserves a 1.9 selected-Root failure as CLI evidence instead of an empty catalog', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-opsx-schemas-failure-'))
    tempDirs.push(projectDir)

    const cliPath = join(projectDir, 'fake-openspec.mjs')
    await writeFile(
      cliPath,
      `
const args = process.argv.slice(2)
if (args.includes('--version')) {
  console.log('1.9.0')
  process.exit(0)
}
if (args[0] === 'schemas' && args.includes('--json')) {
  console.log(JSON.stringify({
    schemas: [],
    root: null,
    status: [
      { severity: 'error', code: 'root-selection', message: 'No openspec root found for schemas.' },
    ],
  }))
  process.exit(1)
}
process.exit(2)
`.trimStart(),
      'utf8'
    )

    const config = new ConfigManager(projectDir)
    await config.writeConfig({ cli: { command: process.execPath, args: [cliPath] } })
    const executor = new CliExecutor(config, projectDir)
    const kernel = new OpsxKernel(projectDir, executor, new RuntimeInvalidationIndex(), {})

    try {
      const bundle = await kernel.readConfigBundleProjection()
      throw new Error(`Expected the failure envelope to reject, got ${JSON.stringify(bundle)}`)
    } catch (error) {
      expect(error).toBeInstanceOf(CliProjectionCommandError)
      if (error instanceof CliProjectionCommandError) {
        expect(error.message).toContain('No openspec root found for schemas.')
        expect(error.cliEvidence.diagnostics).toEqual([
          {
            severity: 'error',
            code: 'root-selection',
            message: 'No openspec root found for schemas.',
          },
        ])
        expect(error.cliEvidence.exitCode).toBe(1)
        expect(error.cliEvidence.success).toBe(false)
      }
    } finally {
      kernel.dispose()
    }
  })
})
