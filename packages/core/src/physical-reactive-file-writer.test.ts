/**
 * Orthogonal intents (updated 2026-08-05 Asia/Shanghai):
 * 1. Prove write, directory-create, remove, and external mutations share physical confinement.
 * 2. Prove owned mutations settle file, directory, existence, and stat projections before return.
 * 3. Prove direct settlement reaches multiple reactive subscribers without watcher timing.
 * 4. Prove atomic replacement changes the inode and survives transient Windows target locks.
 *
 * Original request (2026-07-16): "Schema/Template mutations must reject symlink escape and settle reactive projections before success."
 * Derived requirement (2026-08-02): "Raw Active Root YAML settles only after same-directory atomic replacement."
 * Original request (2026-08-05): Continue the Windows adaptation and fix equivalent failures together.
 */
import { lstat, mkdir, open, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import {
  compareAndWriteAtomicPhysicalReactiveFile,
  createPhysicalReactiveDirectory,
  removePhysicalReactivePath,
  replaceFileAtomically,
  runPhysicalReactivePathMutation,
  writeAtomicPhysicalReactiveFile,
  writePhysicalReactiveFile,
} from './physical-reactive-file-writer.js'
import {
  clearCache,
  ReactiveContext,
  reactiveExists,
  reactiveReadDir,
  reactiveReadFile,
  reactiveStat,
} from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'

interface ProjectionSnapshot {
  content: string | null
  parentEntries: string[]
  targetEntries: string[]
  exists: boolean
  statKind: 'file' | 'directory' | null
}

describe('physical reactive path mutations', () => {
  let rootPath: string
  let externalPath: string

  beforeEach(async () => {
    rootPath = await createTempDir()
    externalPath = await createTempDir()
    await mkdir(join(rootPath, 'openspec', 'schemas', 'demo'), { recursive: true })
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    await closeAllWatchers()
    await Promise.all([cleanupTempDir(rootPath), cleanupTempDir(externalPath)])
  })

  it('rejects intermediate and target symlink escapes for every physical operation', async () => {
    const schemaRelativePath = join('openspec', 'schemas', 'demo')
    const escapedDirectory = join(rootPath, schemaRelativePath, 'escaped')
    await writeFile(join(externalPath, 'outside.md'), '# Outside\n', 'utf8')
    await symlink(externalPath, escapedDirectory, process.platform === 'win32' ? 'junction' : 'dir')

    await expect(
      writePhysicalReactiveFile({
        rootPath,
        relativePath: join(schemaRelativePath, 'escaped', 'written.md'),
        content: '# Escaped\n',
      })
    ).rejects.toThrow(/physical root/i)
    await expect(
      createPhysicalReactiveDirectory({
        rootPath,
        relativePath: join(schemaRelativePath, 'escaped', 'created'),
      })
    ).rejects.toThrow(/physical root/i)
    await expect(
      removePhysicalReactivePath({
        rootPath,
        relativePath: join(schemaRelativePath, 'escaped', 'outside.md'),
      })
    ).rejects.toThrow(/physical root/i)
    await expect(readFile(join(externalPath, 'written.md'), 'utf8')).rejects.toThrow()
    await expect(readFile(join(externalPath, 'outside.md'), 'utf8')).resolves.toBe('# Outside\n')

    // Windows file symlinks require an elevated privilege, while junctions above cover directory escape.
    if (process.platform === 'win32') return

    const externalTarget = join(externalPath, 'target.md')
    const linkedTarget = join(rootPath, schemaRelativePath, 'target.md')
    await writeFile(externalTarget, '# External target\n', 'utf8')
    await symlink(externalTarget, linkedTarget)

    await expect(
      writePhysicalReactiveFile({
        rootPath,
        relativePath: join(schemaRelativePath, 'target.md'),
        content: '# Replaced\n',
      })
    ).rejects.toThrow(/symbolic link|physical root/i)
    await expect(
      removePhysicalReactivePath({
        rootPath,
        relativePath: join(schemaRelativePath, 'target.md'),
      })
    ).rejects.toThrow(/symbolic link|physical root/i)
    await expect(readFile(externalTarget, 'utf8')).resolves.toBe('# External target\n')
    await expect(lstat(linkedTarget)).resolves.toMatchObject({
      isSymbolicLink: expect.any(Function),
    })

    const externalMutation = vi.fn(async () => undefined)
    await expect(
      runPhysicalReactivePathMutation(
        { rootPath, relativePath: join(schemaRelativePath, 'target.md') },
        externalMutation
      )
    ).rejects.toThrow(/symbolic link|physical root/i)
    expect(externalMutation).not.toHaveBeenCalled()
  })

  it('settles missing-leaf write and recursive removal for immediate reads and subscribers', async () => {
    const parentPath = join(rootPath, 'openspec', 'schemas', 'demo')
    const targetDirectoryPath = join(parentPath, 'notes')
    const targetPath = join(targetDirectoryPath, 'decision.md')
    const relativeTargetPath = join('openspec', 'schemas', 'demo', 'notes', 'decision.md')

    const readSnapshot = async (): Promise<ProjectionSnapshot> => {
      const [content, parentEntries, targetEntries, exists, targetStat] = await Promise.all([
        reactiveReadFile(targetPath),
        reactiveReadDir(parentPath),
        reactiveReadDir(targetDirectoryPath),
        reactiveExists(targetPath),
        reactiveStat(targetPath),
      ])
      return {
        content,
        parentEntries,
        targetEntries,
        exists,
        statKind: targetStat?.isFile ? 'file' : targetStat?.isDirectory ? 'directory' : null,
      }
    }

    const firstContext = new ReactiveContext()
    const secondContext = new ReactiveContext()
    const firstStream = firstContext.stream(readSnapshot)
    const secondStream = secondContext.stream(readSnapshot)
    await expect(firstStream.next()).resolves.toMatchObject({
      value: { content: null, exists: false, statKind: null },
    })
    await expect(secondStream.next()).resolves.toMatchObject({
      value: { content: null, exists: false, statKind: null },
    })
    const firstWrite = firstStream.next()
    const secondWrite = secondStream.next()

    await writePhysicalReactiveFile({
      rootPath,
      relativePath: relativeTargetPath,
      content: '# Decision\n',
    })

    await expect(readSnapshot()).resolves.toEqual({
      content: '# Decision\n',
      parentEntries: ['notes'],
      targetEntries: ['decision.md'],
      exists: true,
      statKind: 'file',
    })
    await expect(Promise.all([firstWrite, secondWrite])).resolves.toEqual([
      expect.objectContaining({
        value: expect.objectContaining({ content: '# Decision\n', exists: true, statKind: 'file' }),
      }),
      expect.objectContaining({
        value: expect.objectContaining({ content: '# Decision\n', exists: true, statKind: 'file' }),
      }),
    ])

    const firstRemove = firstStream.next()
    const secondRemove = secondStream.next()
    await removePhysicalReactivePath({
      rootPath,
      relativePath: join('openspec', 'schemas', 'demo', 'notes'),
    })

    await expect(readSnapshot()).resolves.toEqual({
      content: null,
      parentEntries: [],
      targetEntries: [],
      exists: false,
      statKind: null,
    })
    await expect(Promise.all([firstRemove, secondRemove])).resolves.toEqual([
      expect.objectContaining({
        value: expect.objectContaining({ content: null, exists: false, statKind: null }),
      }),
      expect.objectContaining({
        value: expect.objectContaining({ content: null, exists: false, statKind: null }),
      }),
    ])

    await firstStream.return(undefined)
    await secondStream.return(undefined)
  })

  it('atomically replaces a file and settles its exact and parent projections before return', async () => {
    const targetDirectoryPath = join(rootPath, 'openspec', 'schemas', 'demo')
    const targetPath = join(targetDirectoryPath, 'config.yaml')
    const relativeTargetPath = join('openspec', 'schemas', 'demo', 'config.yaml')
    await writeFile(targetPath, 'schema: old\n', 'utf8')
    const before = await stat(targetPath)
    const context = new ReactiveContext()
    const stream = context.stream(async () => ({
      content: await reactiveReadFile(targetPath),
      entries: await reactiveReadDir(targetDirectoryPath),
    }))
    await expect(stream.next()).resolves.toEqual({
      value: { content: 'schema: old\n', entries: ['config.yaml'] },
      done: false,
    })
    const replacement = stream.next()

    await writeAtomicPhysicalReactiveFile({
      rootPath,
      relativePath: relativeTargetPath,
      content: 'schema: replacement\n',
    })

    const after = await stat(targetPath)
    expect(after.ino).not.toBe(before.ino)
    expect(await readFile(targetPath, 'utf8')).toBe('schema: replacement\n')
    expect(await reactiveReadDir(targetDirectoryPath)).toEqual(['config.yaml'])
    await expect(replacement).resolves.toEqual({
      value: { content: 'schema: replacement\n', entries: ['config.yaml'] },
      done: false,
    })
    await stream.return(undefined)
  })

  it.runIf(process.platform === 'win32')(
    'retries a prepared replacement until a transient Windows target lock is released',
    async () => {
      const temporaryPath = join(rootPath, 'replacement.tmp')
      const targetPath = join(rootPath, 'replacement.txt')
      await writeFile(temporaryPath, 'replacement\n', 'utf8')
      await writeFile(targetPath, 'original\n', 'utf8')
      const targetHandle = await open(targetPath, 'r')
      let targetClosed = false

      try {
        const replacement = replaceFileAtomically(temporaryPath, targetPath)
        await new Promise((resolve) => setTimeout(resolve, 750))
        await targetHandle.close()
        targetClosed = true
        await expect(replacement).resolves.toBeUndefined()
        await expect(readFile(targetPath, 'utf8')).resolves.toBe('replacement\n')
      } finally {
        if (!targetClosed) await targetHandle.close()
      }
    }
  )

  it('rejects externally replaced bytes and settles the external source without overwriting it', async () => {
    const targetDirectoryPath = join(rootPath, 'openspec', 'schemas', 'demo')
    const targetPath = join(targetDirectoryPath, 'config.yaml')
    const relativeTargetPath = join('openspec', 'schemas', 'demo', 'config.yaml')
    await writeFile(targetPath, 'schema: revision-a\n', 'utf8')
    expect(await reactiveReadFile(targetPath)).toBe('schema: revision-a\n')
    await writeFile(targetPath, 'schema: external\n', 'utf8')

    const result = await compareAndWriteAtomicPhysicalReactiveFile({
      rootPath,
      relativePath: relativeTargetPath,
      expectedContent: 'schema: revision-a\n',
      content: 'schema: stale-writer\n',
    })

    expect(result).toEqual({ state: 'conflict', content: 'schema: external\n' })
    expect(await readFile(targetPath, 'utf8')).toBe('schema: external\n')
    expect(await reactiveReadFile(targetPath)).toBe('schema: external\n')
    expect(await reactiveReadDir(targetDirectoryPath)).toEqual(['config.yaml'])
  })

  it('settles empty directory creation and guarded external mutation before returning', async () => {
    const schemaPath = join(rootPath, 'openspec', 'schemas', 'demo')
    const emptyDirectoryPath = join(schemaPath, 'empty')
    const generatedPath = join(schemaPath, 'generated', 'schema.yaml')

    expect(await reactiveReadDir(schemaPath)).toEqual([])
    expect(await reactiveExists(emptyDirectoryPath)).toBe(false)
    expect(await reactiveStat(emptyDirectoryPath)).toBeNull()

    await createPhysicalReactiveDirectory({
      rootPath,
      relativePath: join('openspec', 'schemas', 'demo', 'empty'),
    })

    expect(await reactiveReadDir(schemaPath)).toEqual(['empty'])
    expect(await reactiveExists(emptyDirectoryPath)).toBe(true)
    expect(await reactiveStat(emptyDirectoryPath)).toMatchObject({ isDirectory: true })

    expect(await reactiveReadFile(generatedPath)).toBeNull()
    expect(await reactiveExists(generatedPath)).toBe(false)
    await runPhysicalReactivePathMutation(
      {
        rootPath,
        relativePath: join('openspec', 'schemas', 'demo', 'generated'),
      },
      async () => {
        await mkdir(join(schemaPath, 'generated'), { recursive: true })
        await writeFile(generatedPath, 'name: generated\n', 'utf8')
      }
    )
    expect(await reactiveReadFile(generatedPath)).toBe('name: generated\n')
    expect(await reactiveExists(generatedPath)).toBe(true)
  })
})
