/**
 * Orthogonal intents (updated 2026-08-07 Asia/Shanghai):
 * 1. Prove Launch Project local initialization remains independent from a usable external Store Root.
 * 2. Prove the local `openspec/` directory projection replaces reactively after physical initialization.
 * 3. Reject a same-named ordinary file as initialized project structure.
 * 4. Let the native watcher settle before asserting external directory creation delivery on Windows.
 *
 * Original request (2026-08-01): missing local OpenSpec setup must still offer Init when an external Store is usable.
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir, waitForWatcherSettlement } from './__tests__/test-utils.js'
import { OpenSpecAdapter } from './adapter.js'
import { clearCache, ReactiveContext } from './reactive-fs/index.js'
import { acquireWatcherRoot, closeAllWatchers } from './reactive-fs/watcher-pool.js'

const tempDirs: string[] = []

afterEach(async () => {
  clearCache()
  await closeAllWatchers()
  while (tempDirs.length > 0) await cleanupTempDir(tempDirs.pop()!)
})

describe('Launch Project initialization projection', () => {
  it('does not classify an ordinary openspec file as initialized project structure', async () => {
    const launchProject = await createTempDir()
    tempDirs.push(launchProject)
    await writeFile(join(launchProject, 'openspec'), 'not a directory')
    const adapter = new OpenSpecAdapter(launchProject)

    await expect(adapter.readLaunchProjectInitialization()).resolves.toMatchObject({
      initialized: false,
      launchProjectPath: launchProject,
      openspecPath: join(launchProject, 'openspec'),
    })
  })

  it('ignores external Store readiness and reacts only to the local openspec directory', async () => {
    const launchProject = await createTempDir()
    const externalStore = await createTempDir()
    tempDirs.push(launchProject, externalStore)
    await mkdir(join(externalStore, 'openspec', 'specs'), { recursive: true })
    await acquireWatcherRoot(launchProject)
    const adapter = new OpenSpecAdapter(launchProject)
    const externalStoreAdapter = new OpenSpecAdapter(externalStore)
    const context = new ReactiveContext()
    const stream = context.stream(() => adapter.readLaunchProjectInitialization())

    await expect(externalStoreAdapter.readLaunchProjectInitialization()).resolves.toMatchObject({
      initialized: true,
      launchProjectPath: externalStore,
    })

    await expect(stream.next()).resolves.toMatchObject({
      value: {
        initialized: false,
        launchProjectPath: launchProject,
        openspecPath: join(launchProject, 'openspec'),
      },
    })

    const replacement = stream.next()
    await waitForWatcherSettlement()
    await mkdir(join(launchProject, 'openspec'), { recursive: true })
    await expect(replacement).resolves.toMatchObject({ value: { initialized: true } })
    await stream.return(undefined)
  })
})
