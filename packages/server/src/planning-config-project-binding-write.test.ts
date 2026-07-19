/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Prove launch Project Binding writes reject intermediate and final config symlink escapes.
 * 2. Prove the physical owner settles file, directory, existence, and stat projections before return.
 * 3. Preserve launch-write reread evidence for both config.yaml and config.yml ownership.
 *
 * Original request (2026-07-19): "Project Binding launch writes must use the physical/reactive owner."
 */
import {
  clearCache,
  closeAllWatchers,
  ReactiveContext,
  reactiveExists,
  reactiveReadDir,
  reactiveReadFile,
  reactiveStat,
  updateProjectBindingContent,
} from '@openspecui/core'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeProjectBindingConfig } from './planning-config-service.js'

const tempDirs: string[] = []

async function createTempDir(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(path)
  return path
}

afterEach(async () => {
  clearCache()
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('Project Binding physical/reactive launch owner', () => {
  it('settles every overlapping projection before returning launch-write evidence', async () => {
    const launchRoot = await createTempDir('openspecui-binding-reactive-')
    const openspecPath = join(launchRoot, 'openspec')
    const configPath = join(openspecPath, 'config.yaml')
    const update = { store: 'store-b', references: [{ id: 'platform' }] }
    const expectedContent = updateProjectBindingContent(null, update)
    const readSnapshot = async () => {
      const [content, launchEntries, openspecEntries, exists, info] = await Promise.all([
        reactiveReadFile(configPath),
        reactiveReadDir(launchRoot),
        reactiveReadDir(openspecPath),
        reactiveExists(configPath),
        reactiveStat(configPath),
      ])
      return {
        content,
        launchEntries,
        openspecEntries,
        exists,
        statKind: info?.isFile ? 'file' : info?.isDirectory ? 'directory' : null,
      }
    }
    const context = new ReactiveContext()
    const stream = context.stream(readSnapshot)
    await expect(stream.next()).resolves.toMatchObject({
      value: {
        content: null,
        launchEntries: [],
        openspecEntries: [],
        exists: false,
        statKind: null,
      },
    })
    const nextProjection = stream.next()

    const launchWrite = await writeProjectBindingConfig({
      launchProjectDir: launchRoot,
      update,
    })

    const expected = {
      content: expectedContent,
      launchEntries: ['openspec'],
      openspecEntries: ['config.yaml'],
      exists: true,
      statKind: 'file',
    }
    expect(await readSnapshot()).toEqual(expected)
    await expect(nextProjection).resolves.toMatchObject({ value: expected })
    expect(launchWrite.file).toMatchObject({
      path: configPath,
      exists: true,
      format: 'yaml',
      content: expected.content,
    })
    expect(launchWrite.binding.store).toEqual({ state: 'declared', id: 'store-b' })
    await stream.return(undefined)
  })

  it('preserves an existing config.yml owner through reactive write and reread', async () => {
    const launchRoot = await createTempDir('openspecui-binding-yml-')
    const openspecPath = join(launchRoot, 'openspec')
    const yamlPath = join(openspecPath, 'config.yaml')
    const ymlPath = join(openspecPath, 'config.yml')
    const initialContent = 'schema: custom\n'
    const update = { store: 'store-b', references: [{ id: 'platform' }] }
    const expectedContent = updateProjectBindingContent(initialContent, update)
    await mkdir(openspecPath, { recursive: true })
    await writeFile(ymlPath, initialContent, 'utf8')

    const readSnapshot = async () => {
      const [content, entries, ymlExists, yamlExists, info] = await Promise.all([
        reactiveReadFile(ymlPath),
        reactiveReadDir(openspecPath),
        reactiveExists(ymlPath),
        reactiveExists(yamlPath),
        reactiveStat(ymlPath),
      ])
      return {
        content,
        entries,
        ymlExists,
        yamlExists,
        statKind: info?.isFile ? 'file' : info?.isDirectory ? 'directory' : null,
      }
    }
    const context = new ReactiveContext()
    const stream = context.stream(readSnapshot)
    await expect(stream.next()).resolves.toMatchObject({
      value: {
        content: initialContent,
        entries: ['config.yml'],
        ymlExists: true,
        yamlExists: false,
        statKind: 'file',
      },
    })
    const nextProjection = stream.next()

    const launchWrite = await writeProjectBindingConfig({
      launchProjectDir: launchRoot,
      update,
    })

    const expected = {
      content: expectedContent,
      entries: ['config.yml'],
      ymlExists: true,
      yamlExists: false,
      statKind: 'file',
    }
    expect(await readSnapshot()).toEqual(expected)
    await expect(nextProjection).resolves.toMatchObject({ value: expected })
    await expect(readFile(ymlPath, 'utf8')).resolves.toBe(expectedContent)
    await expect(readFile(yamlPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    expect(launchWrite.file).toEqual({
      path: ymlPath,
      exists: true,
      format: 'yml',
      content: expectedContent,
    })
    expect(launchWrite.binding).toMatchObject({
      store: { state: 'declared', id: 'store-b' },
      references: { state: 'declared', entries: [{ id: 'platform' }] },
    })
    await stream.return(undefined)
  })

  it('rejects an intermediate openspec symlink without changing its external config', async () => {
    const launchRoot = await createTempDir('openspecui-binding-intermediate-')
    const externalRoot = await createTempDir('openspecui-binding-external-')
    const externalConfig = join(externalRoot, 'config.yaml')
    await writeFile(externalConfig, 'store: external\n', 'utf8')
    await symlink(externalRoot, join(launchRoot, 'openspec'), 'dir')

    await expect(
      writeProjectBindingConfig({
        launchProjectDir: launchRoot,
        update: { store: 'store-b' },
      })
    ).rejects.toThrow(/physical root/i)
    await expect(readFile(externalConfig, 'utf8')).resolves.toBe('store: external\n')
  })

  it.each(['yaml', 'yml'] as const)(
    'rejects a final config.%s symlink without changing its external file',
    async (extension) => {
      const launchRoot = await createTempDir(`openspecui-binding-${extension}-`)
      const externalRoot = await createTempDir('openspecui-binding-external-')
      const openspecPath = join(launchRoot, 'openspec')
      const externalConfig = join(externalRoot, `config.${extension}`)
      await mkdir(openspecPath, { recursive: true })
      await writeFile(externalConfig, 'store: external\n', 'utf8')
      await symlink(externalConfig, join(openspecPath, `config.${extension}`))

      await expect(
        writeProjectBindingConfig({
          launchProjectDir: launchRoot,
          update: { store: 'store-b' },
        })
      ).rejects.toThrow(/symbolic link|physical root/i)
      await expect(readFile(externalConfig, 'utf8')).resolves.toBe('store: external\n')
    }
  )
})
