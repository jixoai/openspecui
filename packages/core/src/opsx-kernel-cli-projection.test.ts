/**
 * Orthogonal intents (updated 2026-08-05 Asia/Shanghai):
 * 1. Prove OPSX Change enumeration comes from the executable typed OpenSpec CLI contract.
 * 2. Prove physical Change directories remain invalidation evidence rather than projected business truth.
 * 3. Preserve the exact Store-selected CLI payload and process evidence in the retained projection.
 * 4. Prove aggregate CLI projections submit entity work lazily instead of monopolizing admission.
 * 5. Preserve cross-platform schema-template paths in executable CLI fixtures.
 * Original request (2026-08-05): "Continue the Windows adaptation and fix equivalent failures together."
 *
 * Original request (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。"
 * Original request (2026-07-31): "系统性地进行修复，因为List页面也有类似的问题。所有可能其它页面都有类似的问题。"
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir } from './__tests__/test-utils.js'
import { CliExecutor } from './cli-executor.js'
import { CliProjectionCommandError } from './cli-projection.js'
import { ConfigManager } from './config.js'
import { OpsxKernel } from './opsx-kernel.js'
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
