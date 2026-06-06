import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import { OpenSpecAdapter } from './adapter.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'

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

  it('computes schema-driven change progress without requiring proposal.md', async () => {
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
    expect(meta?.progress).toEqual({ total: 3, completed: 2 })
  })

  it('computes archived schema task progress from matched markdown files', async () => {
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

    expect(meta?.progress).toEqual({ total: 1, completed: 1 })
  })
})
