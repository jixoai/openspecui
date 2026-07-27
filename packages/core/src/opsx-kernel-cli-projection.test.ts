/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Prove OPSX Change enumeration comes from the executable typed OpenSpec CLI contract.
 * 2. Prove physical Change directories remain invalidation evidence rather than projected business truth.
 * 3. Preserve the exact Store-selected CLI payload and process evidence in the retained projection.
 *
 * Original request (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。"
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CliExecutor } from './cli-executor.js'
import { ConfigManager } from './config.js'
import { OpsxKernel } from './opsx-kernel.js'
import { RuntimeInvalidationIndex } from './runtime-invalidation.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
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
      path: schemaDir + '/templates/proposal.md',
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
