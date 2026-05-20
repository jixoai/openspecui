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
    closeAllWatchers()
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
})
