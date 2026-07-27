/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove write, directory-create, remove, and external mutations share physical confinement.
 * 2. Prove owned mutations settle file, directory, existence, and stat projections before return.
 * 3. Prove direct settlement reaches multiple reactive subscribers without watcher timing.
 *
 * Original request (2026-07-16): "Schema/Template mutations must reject symlink escape and settle reactive projections before success."
 */
import { lstat, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import {
  createPhysicalReactiveDirectory,
  removePhysicalReactivePath,
  runPhysicalReactivePathMutation,
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
    await symlink(externalPath, escapedDirectory, 'dir')

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
