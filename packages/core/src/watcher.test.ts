/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Prove watcher close settles native directory handles before filesystem cleanup.
 * 2. Prove Windows recursive-watch separators preserve spec/change/archive identity.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type FileChangeEvent, OpenSpecWatcher } from './watcher.js'

const tempDirs: string[] = []

async function waitForEvents(
  events: readonly FileChangeEvent[],
  predicate: (events: readonly FileChangeEvent[]) => boolean
): Promise<void> {
  const deadline = Date.now() + 5_000
  while (!predicate(events)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for watcher events: ${JSON.stringify(events)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }))
  )
})

describe('OpenSpecWatcher', () => {
  it('settles native directory handles before close resolves', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-legacy-watcher-'))
    tempDirs.push(projectDir)
    await mkdir(join(projectDir, 'openspec', 'specs'), { recursive: true })
    await mkdir(join(projectDir, 'openspec', 'changes', 'archive'), { recursive: true })

    const watcher = new OpenSpecWatcher(projectDir)
    watcher.start()
    await watcher.close()

    await expect(rm(projectDir, { recursive: true, force: true })).resolves.toBeUndefined()
    tempDirs.splice(tempDirs.indexOf(projectDir), 1)
  })

  it.runIf(process.platform === 'win32')(
    'projects Windows child paths without leaking archived changes as active changes',
    async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-legacy-watcher-events-'))
      tempDirs.push(projectDir)
      const specDir = join(projectDir, 'openspec', 'specs', 'alpha')
      const changeDir = join(projectDir, 'openspec', 'changes', 'beta')
      const archiveDir = join(projectDir, 'openspec', 'changes', 'archive', 'old')
      await Promise.all([
        mkdir(specDir, { recursive: true }),
        mkdir(changeDir, { recursive: true }),
        mkdir(archiveDir, { recursive: true }),
      ])

      const events: FileChangeEvent[] = []
      const watcher = new OpenSpecWatcher(projectDir, { debounceMs: 10 })
      watcher.on('change', (event: FileChangeEvent) => events.push(event))
      watcher.start()

      await Promise.all([
        writeFile(join(specDir, 'spec.md'), '# alpha'),
        writeFile(join(changeDir, 'proposal.md'), '# beta'),
        writeFile(join(archiveDir, 'proposal.md'), '# old'),
      ])
      await waitForEvents(
        events,
        (current) =>
          current.some((event) => event.type === 'spec' && event.id === 'alpha') &&
          current.some((event) => event.type === 'change' && event.id === 'beta') &&
          current.some((event) => event.type === 'archive' && event.id === 'old')
      )
      await new Promise((resolve) => setTimeout(resolve, 50))
      await watcher.close()

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'spec', id: 'alpha' }),
          expect.objectContaining({ type: 'change', id: 'beta' }),
          expect.objectContaining({ type: 'archive', id: 'old' }),
        ])
      )
      expect(events).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'change', id: 'archive' })])
      )
    }
  )
})
