/**
 * Orthogonal intents (updated 2026-08-05 Asia/Shanghai):
 * 1. Prove project Schema mutations remain inside the selected Planning root.
 * 2. Prove physical symlink confinement and immediate reactive settlement across Schema writes.
 * 3. Prove typed Schema init/fork commands do not require the public generic CLI boundary.
 * 4. Use junction-based directory escape evidence and settled cleanup on Windows.
 *
 * Original request (2026-07-16): "Schema/Template mutations must reject symlink escape and settle reactive projections before success."
 */
import type { CliResult, SchemaResolution, TemplatesMap } from '@openspecui/core'
import { reactiveExists, reactiveReadFile } from '@openspecui/core/reactive-fs'
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SchemaMutationService, type SchemaMutationKernel } from './schema-mutation-service.js'
import { removeServerTestDirectories } from './server-test-cleanup.js'

const tempDirs: string[] = []

afterEach(async () => {
  await removeServerTestDirectories(tempDirs.splice(0))
})

function successfulCliResult(): CliResult {
  return { success: true, stdout: '{}', stderr: '', exitCode: 0 }
}

describe('SchemaMutationService', () => {
  it.each([
    { action: 'write-yaml' as const, schema: '../outside', content: 'name: outside\n' },
    { action: 'write-file' as const, schema: 'demo', path: '../outside.md', content: 'outside' },
    { action: 'create-file' as const, schema: 'demo', path: 'C:\\outside.md' },
    { action: 'create-directory' as const, schema: 'demo', path: '\\server\\share' },
    { action: 'delete-entry' as const, schema: 'demo', path: '' },
    { action: 'write-template' as const, schema: 'demo', artifactId: '../proposal', content: '' },
    { action: 'delete-schema' as const, schema: 'nested/schema' },
    { action: 'init' as const, name: 'Not Kebab' },
    { action: 'fork' as const, source: '../package', name: 'valid-name' },
  ])('rejects malformed $action before kernel, CLI, or filesystem access', async (action) => {
    const kernel: SchemaMutationKernel = {
      ensureSchemaResolution: vi.fn(),
      getSchemaResolution: vi.fn(),
      ensureTemplates: vi.fn(),
      getTemplates: vi.fn(),
    }
    const execute = vi.fn()
    const service = new SchemaMutationService({
      planningRoot: '/planning',
      cliExecutor: { execute },
      kernel,
    })

    await expect(service.mutate(action)).rejects.toThrow(/invalid|kebab|relative/i)

    expect(kernel.ensureSchemaResolution).not.toHaveBeenCalled()
    expect(kernel.ensureTemplates).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('confines project Schema writes, settles reactive values, and rejects symlink escape', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-schema-mutation-'))
    tempDirs.push(tempDir)
    const planningRoot = join(tempDir, 'planning')
    const schemaName = 'project-schema'
    const schemaRoot = join(planningRoot, 'openspec', 'schemas', schemaName)
    const templatePath = join(schemaRoot, 'templates', 'proposal.md')
    const externalRoot = join(tempDir, 'outside')
    await Promise.all([
      mkdir(join(schemaRoot, 'templates'), { recursive: true }),
      mkdir(externalRoot, { recursive: true }),
    ])
    await Promise.all([
      writeFile(join(schemaRoot, 'schema.yaml'), 'name: project-schema\n', 'utf8'),
      writeFile(templatePath, '# Old template\n', 'utf8'),
    ])

    const resolution = {
      name: schemaName,
      source: 'project',
      path: schemaRoot,
      shadows: [],
    } satisfies SchemaResolution
    const templates = {
      proposal: { path: templatePath, source: 'project' },
    } satisfies TemplatesMap
    const kernel: SchemaMutationKernel = {
      ensureSchemaResolution: vi.fn().mockResolvedValue(undefined),
      getSchemaResolution: vi.fn().mockReturnValue(resolution),
      ensureTemplates: vi.fn().mockResolvedValue(undefined),
      getTemplates: vi.fn().mockReturnValue(templates),
    }
    const execute = vi.fn().mockResolvedValue(successfulCliResult())
    const service = new SchemaMutationService({
      planningRoot,
      cliExecutor: { execute },
      kernel,
    })

    const schemaYamlPath = join(schemaRoot, 'schema.yaml')
    const newFilePath = join(schemaRoot, 'notes', 'draft.md')
    await Promise.all([reactiveReadFile(schemaYamlPath), reactiveReadFile(newFilePath)])

    await service.mutate({ action: 'write-yaml', schema: schemaName, content: 'name: updated\n' })
    await service.mutate({
      action: 'write-file',
      schema: schemaName,
      path: 'notes/draft.md',
      content: '# Draft\n',
    })
    await service.mutate({
      action: 'create-directory',
      schema: schemaName,
      path: 'generated/nested',
    })
    await service.mutate({
      action: 'write-template',
      schema: schemaName,
      artifactId: 'proposal',
      content: '# Updated template\n',
    })

    await expect(reactiveReadFile(schemaYamlPath)).resolves.toBe('name: updated\n')
    await expect(reactiveReadFile(newFilePath)).resolves.toBe('# Draft\n')
    await expect(readFile(templatePath, 'utf8')).resolves.toBe('# Updated template\n')
    await expect(reactiveExists(join(schemaRoot, 'generated', 'nested'))).resolves.toBe(true)

    await symlink(
      externalRoot,
      join(schemaRoot, 'escape'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )
    await expect(
      service.mutate({
        action: 'write-file',
        schema: schemaName,
        path: 'escape/pwn.md',
        content: 'outside\n',
      })
    ).rejects.toThrow(/physical|symbolic link/i)
    await expect(readFile(join(externalRoot, 'pwn.md'), 'utf8')).rejects.toThrow()

    await service.mutate({ action: 'delete-entry', schema: schemaName, path: 'notes/draft.md' })
    await expect(reactiveReadFile(newFilePath)).resolves.toBeNull()

    const userResolution = { ...resolution, source: 'user' as const }
    ;(kernel.getSchemaResolution as ReturnType<typeof vi.fn>).mockReturnValue(userResolution)
    await expect(
      service.mutate({ action: 'write-yaml', schema: schemaName, content: 'name: forbidden\n' })
    ).rejects.toThrow(/project.*read-only|read-only.*project/i)
  })

  it('runs init and fork from the selected Planning root through typed commands', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-schema-command-'))
    tempDirs.push(tempDir)
    const planningRoot = join(tempDir, 'planning')
    await mkdir(join(planningRoot, 'openspec', 'schemas'), { recursive: true })
    const kernel: SchemaMutationKernel = {
      ensureSchemaResolution: vi.fn().mockResolvedValue(undefined),
      getSchemaResolution: vi.fn(),
      ensureTemplates: vi.fn().mockResolvedValue(undefined),
      getTemplates: vi.fn(),
    }
    const execute = vi.fn().mockResolvedValue(successfulCliResult())
    const service = new SchemaMutationService({
      planningRoot,
      cliExecutor: { execute },
      kernel,
    })

    await service.mutate({ action: 'init', name: 'new-schema' })
    await service.mutate({ action: 'fork', source: 'spec-driven', name: 'derived-schema' })

    expect(execute).toHaveBeenNthCalledWith(1, [
      'schema',
      'init',
      'new-schema',
      '--json',
      '--no-default',
    ])
    expect(execute).toHaveBeenNthCalledWith(2, [
      'schema',
      'fork',
      'spec-driven',
      'derived-schema',
      '--json',
    ])
  })
})
