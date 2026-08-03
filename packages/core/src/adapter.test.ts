/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Prove Adapter document reads and writes remain physically scoped and reactive.
 * 2. Prove recursive Spec identities retain every segment across list, read, and write.
 * 3. Prove schema-neutral Change and Archive projections preserve workflow evidence.
 * 4. Prove filesystem symlink and traversal boundaries reject physical-root escape.
 *
 * Original request (2026-08-01): adapt OpenSpec 1.7 nested Spec ids such as `platform/auth`.
 */
import { mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import { OpenSpecAdapter } from './adapter.js'
import { clearCache, ReactiveContext, reactiveReadFile } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'
import type { ChangeFile } from './schemas.js'

describe('OpenSpecAdapter change files', () => {
  let tempDir: string
  let adapter: OpenSpecAdapter

  beforeEach(async () => {
    tempDir = await createTempDir()
    adapter = new OpenSpecAdapter(tempDir)
    await mkdir(join(tempDir, 'openspec', 'changes', 'demo'), { recursive: true })
    await writeFile(join(tempDir, 'openspec', 'changes', 'demo', 'proposal.md'), '# Demo', 'utf-8')
    await writeFile(
      join(tempDir, 'openspec', 'changes', 'demo', '.openspec.yaml'),
      'schema: spec-driven\n',
      'utf-8'
    )
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('includes hidden metadata file in change folder listing', async () => {
    const files = await adapter.readChangeFiles('demo')
    const metadata = files.find((file) => file.path === '.openspec.yaml' && file.type === 'file')

    expect(metadata).toBeDefined()
    expect(metadata?.content).toContain('schema:')
    expect(metadata?.mime).toBe('application/yaml')
    expect(metadata?.previewKind).toBe('text')
  })

  it('does not force binary files into utf-8 content', async () => {
    const binary = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
    await writeFile(join(tempDir, 'openspec', 'changes', 'demo', 'preview.png'), binary)

    const files = await adapter.readChangeFiles('demo')
    const image = files.find((file) => file.path === 'preview.png' && file.type === 'file')

    expect(image).toBeDefined()
    expect(image?.content).toBeUndefined()
    expect(image?.mime).toBe('image/png')
    expect(image?.previewKind).toBe('image')
  })

  it('initializes project.md without creating openspec/AGENTS.md', async () => {
    await adapter.init()

    await expect(stat(join(tempDir, 'openspec', 'project.md'))).resolves.toBeDefined()
    await expect(stat(join(tempDir, 'openspec', 'AGENTS.md'))).rejects.toThrow()
  })

  it('rejects intermediate-directory and existing-target symlink escapes', async () => {
    const externalDir = await createTempDir()
    try {
      await mkdir(join(tempDir, 'openspec', 'specs'), { recursive: true })
      await symlink(externalDir, join(tempDir, 'openspec', 'specs', 'escaped'))

      await expect(adapter.writeSpec('escaped', '# Escaped\n')).rejects.toThrow(/physical root/i)
      await expect(readFile(join(externalDir, 'spec.md'), 'utf8')).rejects.toThrow()

      const changeDir = join(tempDir, 'openspec', 'changes', 'existing-target')
      const externalTarget = join(externalDir, 'proposal.md')
      await mkdir(changeDir, { recursive: true })
      await writeFile(externalTarget, '# External\n', 'utf8')
      await symlink(externalTarget, join(changeDir, 'proposal.md'))

      await expect(adapter.writeChange('existing-target', '# Changed\n')).rejects.toThrow(
        /physical root/i
      )
      await expect(readFile(externalTarget, 'utf8')).resolves.toBe('# External\n')
    } finally {
      await cleanupTempDir(externalDir)
    }
  })

  it('settles direct writes for immediate reads and multiple subscribers', async () => {
    const specPath = join(tempDir, 'openspec', 'specs', 'reactive', 'spec.md')
    await adapter.writeSpec('reactive', '# Before\n')
    expect(await reactiveReadFile(specPath)).toBe('# Before\n')

    const firstContext = new ReactiveContext()
    const secondContext = new ReactiveContext()
    const firstStream = firstContext.stream(() => reactiveReadFile(specPath))
    const secondStream = secondContext.stream(() => reactiveReadFile(specPath))
    expect((await firstStream.next()).value).toBe('# Before\n')
    expect((await secondStream.next()).value).toBe('# Before\n')
    const firstUpdate = firstStream.next()
    const secondUpdate = secondStream.next()

    await adapter.writeSpec('reactive', '# After\n')

    expect(await reactiveReadFile(specPath)).toBe('# After\n')
    await expect(Promise.all([firstUpdate, secondUpdate])).resolves.toEqual([
      expect.objectContaining({ value: '# After\n' }),
      expect.objectContaining({ value: '# After\n' }),
    ])

    const proposalPath = join(tempDir, 'openspec', 'changes', 'reactive-change', 'proposal.md')
    const tasksPath = join(tempDir, 'openspec', 'changes', 'reactive-change', 'tasks.md')
    expect(await reactiveReadFile(proposalPath)).toBeNull()
    expect(await reactiveReadFile(tasksPath)).toBeNull()
    await adapter.writeChange('reactive-change', '# Proposal\n', '- [ ] Task\n')
    expect(await reactiveReadFile(proposalPath)).toBe('# Proposal\n')
    expect(await reactiveReadFile(tasksPath)).toBe('- [ ] Task\n')

    const firstListContext = new ReactiveContext()
    const secondListContext = new ReactiveContext()
    const firstListStream = firstListContext.stream(() => adapter.listSpecs())
    const secondListStream = secondListContext.stream(() => adapter.listSpecs())
    expect((await firstListStream.next()).value).toContain('reactive')
    expect((await secondListStream.next()).value).toContain('reactive')
    const firstListUpdate = firstListStream.next()
    const secondListUpdate = secondListStream.next()
    await adapter.writeSpec('reactive-new', '# New\n')
    await expect(Promise.all([firstListUpdate, secondListUpdate])).resolves.toEqual([
      expect.objectContaining({ value: expect.arrayContaining(['reactive-new']) }),
      expect.objectContaining({ value: expect.arrayContaining(['reactive-new']) }),
    ])

    await firstStream.return(undefined)
    await secondStream.return(undefined)
    await firstListStream.return(undefined)
    await secondListStream.return(undefined)
  })

  it('lists, reads, and writes a recursive Spec identity without flattening', async () => {
    await adapter.writeSpec('platform/auth', '# Platform Auth\n')

    await expect(adapter.listSpecs()).resolves.toContain('platform/auth')
    await expect(adapter.readSpecRaw('platform/auth')).resolves.toBe('# Platform Auth\n')
    await expect(
      readFile(join(tempDir, 'openspec', 'specs', 'platform', 'auth', 'spec.md'), 'utf8')
    ).resolves.toBe('# Platform Auth\n')
  })

  it('fails loudly on Spec discovery errors and sorts recursive ids by code point', async () => {
    await Promise.all([
      adapter.writeSpec('alpha', '# Alpha\n'),
      adapter.writeSpec('Zed', '# Zed\n'),
      adapter.writeSpec('Ångstrom/nested', '# Angstrom\n'),
    ])
    await expect(adapter.listSpecs()).resolves.toEqual(['Zed', 'alpha', 'Ångstrom/nested'])

    const invalidRoot = await createTempDir()
    try {
      await mkdir(join(invalidRoot, 'openspec'), { recursive: true })
      await writeFile(join(invalidRoot, 'openspec', 'specs'), 'not a directory', 'utf8')
      clearCache()
      await expect(new OpenSpecAdapter(invalidRoot).listSpecs()).rejects.toMatchObject({
        code: 'ENOTDIR',
      })
    } finally {
      await cleanupTempDir(invalidRoot)
    }
  })

  it('settles newly created entity files for two directory subscribers', async () => {
    const firstContext = new ReactiveContext()
    const secondContext = new ReactiveContext()
    const firstStream = firstContext.stream(() => adapter.readChangeFiles('demo'))
    const secondStream = secondContext.stream(() => adapter.readChangeFiles('demo'))
    await firstStream.next()
    await secondStream.next()
    const firstUpdate = (async () => {
      while (true) {
        const result = await firstStream.next()
        if (result.value?.some((file: ChangeFile) => file.path === 'notes/reactive.md'))
          return result
      }
    })()
    const secondUpdate = (async () => {
      while (true) {
        const result = await secondStream.next()
        if (result.value?.some((file: ChangeFile) => file.path === 'notes/reactive.md'))
          return result
      }
    })()

    await adapter.writeEntityFile('change', 'demo', 'notes/reactive.md', '# Entity\n')

    await expect(Promise.all([firstUpdate, secondUpdate])).resolves.toEqual([
      expect.objectContaining({
        value: expect.arrayContaining([
          expect.objectContaining({ path: 'notes/reactive.md', content: '# Entity\n' }),
        ]),
      }),
      expect.objectContaining({
        value: expect.arrayContaining([
          expect.objectContaining({ path: 'notes/reactive.md', content: '# Entity\n' }),
        ]),
      }),
    ])
    await firstStream.return(undefined)
    await secondStream.return(undefined)
  })

  it('separates tracked workflow tasks from schema-document checklists', async () => {
    const changeDir = join(tempDir, 'openspec', 'changes', 'vision-demo')
    await mkdir(join(tempDir, 'openspec', 'schemas', 'vision-driven'), { recursive: true })
    await mkdir(join(changeDir, 'plans'), { recursive: true })
    await writeFile(join(changeDir, '.openspec.yaml'), 'schema: vision-driven\n', 'utf-8')
    await writeFile(
      join(tempDir, 'openspec', 'schemas', 'vision-driven', 'schema.yaml'),
      `name: vision-driven
artifacts:
  - id: plan
    generates: plans/*.md
  - id: tasks
    generates: tasks.md
apply:
  tracks: tasks.md
`,
      'utf-8'
    )
    await writeFile(join(changeDir, 'tasks.md'), '- [x] Done\n- [ ] Todo\n', 'utf-8')
    await writeFile(join(changeDir, 'plans', 'plan.md'), '- [x] Planned\n', 'utf-8')
    await writeFile(join(changeDir, 'notes.md'), '- [x] Untracked\n', 'utf-8')
    clearCache()

    const changes = await adapter.listChangesWithMeta()
    const meta = changes.find((change) => change.id === 'vision-demo')

    expect(meta?.name).toBe('vision-demo')
    expect(meta?.trackedTaskProgress).toMatchObject({
      total: 2,
      completed: 1,
      phase: 'in-progress',
      source: { kind: 'artifact', artifactId: 'tasks', outputPath: 'tasks.md' },
    })
    expect(meta?.documentChecklistSummary).toMatchObject({ total: 3, completed: 2 })
  })

  it('keeps non-tracked archived schema checklists secondary', async () => {
    const archiveDir = join(tempDir, 'openspec', 'changes', 'archive', '2026-06-01-vision-demo')
    await mkdir(join(tempDir, 'openspec', 'schemas', 'vision-driven'), { recursive: true })
    await mkdir(join(archiveDir, 'plan'), { recursive: true })
    await writeFile(join(archiveDir, '.openspec.yaml'), 'schema: vision-driven\n', 'utf-8')
    await writeFile(
      join(tempDir, 'openspec', 'schemas', 'vision-driven', 'schema.yaml'),
      `name: vision-driven
artifacts:
  - id: plan
    generates: plan/*.md
`,
      'utf-8'
    )
    await writeFile(join(archiveDir, 'plan', 'todo.md'), '- [x] Archived task\n', 'utf-8')
    clearCache()

    const archives = await adapter.listArchivedChangesWithMeta()
    const meta = archives.find((archive) => archive.id === '2026-06-01-vision-demo')

    expect(meta?.trackedTaskProgress).toMatchObject({ total: 0, completed: 0, phase: 'no-tasks' })
    expect(meta?.documentChecklistSummary).toMatchObject({ total: 1, completed: 1 })
  })
})
