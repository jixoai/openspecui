import { mkdir, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectWatcher } from './project-watcher.js'

const tempDirs: string[] = []

async function createTempRoot(): Promise<string> {
  const root = join(tmpdir(), `openspecui-project-watcher-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await mkdir(root, { recursive: true })
  tempDirs.push(root)
  return root
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('ProjectWatcher path liveness', () => {
  it('schedules reinitialize when project directory is missing', async () => {
    const root = await createTempRoot()
    const projectDir = join(root, 'project')
    await mkdir(projectDir, { recursive: true })

    const watcher = new ProjectWatcher(projectDir)
    ;(watcher as unknown as { initialized: boolean }).initialized = true
    ;(watcher as unknown as { projectDirFingerprint: string | null }).projectDirFingerprint = '1:1'

    const scheduleSpy = vi
      .spyOn(watcher as unknown as { scheduleReinitialize: (reason: string) => void }, 'scheduleReinitialize')
      .mockImplementation(() => {})

    await rm(projectDir, { recursive: true, force: true })
    ;(watcher as unknown as { checkPathLiveness: () => void }).checkPathLiveness()

    expect(scheduleSpy).toHaveBeenCalledWith('missing-project-dir')
  })

  it('does not reinitialize when only mode changes (fingerprint ignores mode)', async () => {
    const root = await createTempRoot()
    const projectDir = join(root, 'project')
    await mkdir(projectDir, { recursive: true })

    const watcher = new ProjectWatcher(projectDir)
    ;(watcher as unknown as { initialized: boolean }).initialized = true
    ;(watcher as unknown as { projectDirFingerprint: string | null }).projectDirFingerprint = (
      watcher as unknown as { getProjectDirFingerprint: () => string | null }
    ).getProjectDirFingerprint()

    const scheduleSpy = vi
      .spyOn(watcher as unknown as { scheduleReinitialize: (reason: string) => void }, 'scheduleReinitialize')
      .mockImplementation(() => {})

    ;(watcher as unknown as { checkPathLiveness: () => void }).checkPathLiveness()
    expect(scheduleSpy).not.toHaveBeenCalled()
  })

  it('detects replaced project directory on macOS', async () => {
    if (process.platform !== 'darwin') {
      expect(true).toBe(true)
      return
    }

    const root = await createTempRoot()
    const projectDir = join(root, 'project')
    const movedDir = join(root, 'project-moved')
    await mkdir(projectDir, { recursive: true })

    const watcher = new ProjectWatcher(projectDir)
    ;(watcher as unknown as { initialized: boolean }).initialized = true
    ;(watcher as unknown as { projectDirFingerprint: string | null }).projectDirFingerprint = (
      watcher as unknown as { getProjectDirFingerprint: () => string | null }
    ).getProjectDirFingerprint()

    const scheduleSpy = vi
      .spyOn(watcher as unknown as { scheduleReinitialize: (reason: string) => void }, 'scheduleReinitialize')
      .mockImplementation(() => {})

    await rename(projectDir, movedDir)
    await mkdir(projectDir, { recursive: true })
    ;(watcher as unknown as { checkPathLiveness: () => void }).checkPathLiveness()

    expect(scheduleSpy).toHaveBeenCalledWith('project-dir-replaced')
  })
})
