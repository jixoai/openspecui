/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove watcher-root path-liveness and replacement recovery.
 * 2. Prove explicitly opted-in missing paths accept one coalesced ancestor creation event.
 *
 * Original request (2026-07-15): "响应式内核要观察 data home、Store roots 和 connected project roots。"
 * Remote CI fixed point (2026-07-28): data-home Schema creation may arrive as an ancestor event on Linux.
 */
import { realpathSync } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectWatcher } from './project-watcher.js'

const tempDirs: string[] = []

async function createTempRoot(): Promise<string> {
  const root = join(
    tmpdir(),
    `openspecui-project-watcher-${Date.now()}-${Math.random().toString(16).slice(2)}`
  )
  await mkdir(root, { recursive: true })
  tempDirs.push(root)
  return root
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('ProjectWatcher path liveness', () => {
  it('keeps ancestor matching disabled for ordinary missing-path subscriptions', async () => {
    const root = await createTempRoot()
    const target = join(root, 'data', 'openspec', 'schemas')
    const watcher = new ProjectWatcher(root, { debounceMs: 0 })
    ;(watcher as unknown as { initialized: boolean }).initialized = true
    const onChange = vi.fn()
    const release = watcher.subscribeSync(target, onChange, { watchChildren: true })

    try {
      await mkdir(target, { recursive: true })
      ;(
        watcher as unknown as {
          handleEvents: (events: Array<{ type: 'create'; path: string }>) => void
        }
      ).handleEvents([{ type: 'create', path: join(realpathSync(root), 'data') }])

      await new Promise((resolve) => setTimeout(resolve, 25))
      expect(onChange).not.toHaveBeenCalled()
    } finally {
      release()
      await watcher.close()
    }
  })

  it('settles opted-in missing path creation from a coalesced ancestor event', async () => {
    const root = await createTempRoot()
    const target = join(root, 'data', 'openspec', 'schemas')
    const watcher = new ProjectWatcher(root, { debounceMs: 0 })
    ;(watcher as unknown as { initialized: boolean }).initialized = true
    const onChange = vi.fn()
    const release = watcher.subscribeSync(target, onChange, {
      watchChildren: true,
      watchAncestorsWhileMissing: true,
    })

    try {
      await mkdir(target, { recursive: true })
      ;(
        watcher as unknown as {
          handleEvents: (events: Array<{ type: 'create'; path: string }>) => void
        }
      ).handleEvents([{ type: 'create', path: join(realpathSync(root), 'data') }])

      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 500 })

      onChange.mockClear()
      ;(
        watcher as unknown as {
          handleEvents: (events: Array<{ type: 'create'; path: string }>) => void
        }
      ).handleEvents([{ type: 'create', path: join(realpathSync(root), 'data') }])
      await new Promise((resolve) => setTimeout(resolve, 25))
      expect(onChange).not.toHaveBeenCalled()
    } finally {
      release()
      await watcher.close()
    }
  })

  it('schedules reinitialize when project directory is missing', async () => {
    const root = await createTempRoot()
    const projectDir = join(root, 'project')
    await mkdir(projectDir, { recursive: true })

    const watcher = new ProjectWatcher(projectDir)
    ;(watcher as unknown as { initialized: boolean }).initialized = true
    ;(watcher as unknown as { projectDirFingerprint: string | null }).projectDirFingerprint = '1:1'

    const scheduleSpy = vi
      .spyOn(
        watcher as unknown as { scheduleReinitialize: (reason: string) => void },
        'scheduleReinitialize'
      )
      .mockImplementation(() => {})

    await rm(projectDir, { recursive: true, force: true })
    ;(watcher as unknown as { checkPathLiveness: () => void }).checkPathLiveness()

    expect(scheduleSpy).toHaveBeenCalledWith('missing-project-dir')
    expect(watcher.runtimeStatus.projectResidency.state).toBe('evicted')
    expect(watcher.runtimeStatus.projectResidency).toMatchObject({
      state: 'evicted',
      reason: 'missing-project-dir',
    })
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
      .spyOn(
        watcher as unknown as { scheduleReinitialize: (reason: string) => void },
        'scheduleReinitialize'
      )
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
      .spyOn(
        watcher as unknown as { scheduleReinitialize: (reason: string) => void },
        'scheduleReinitialize'
      )
      .mockImplementation(() => {})

    await rename(projectDir, movedDir)
    await mkdir(projectDir, { recursive: true })
    ;(watcher as unknown as { checkPathLiveness: () => void }).checkPathLiveness()

    expect(scheduleSpy).toHaveBeenCalledWith('project-dir-replaced')
    expect(watcher.runtimeStatus.projectResidency).toMatchObject({
      state: 'evicted',
      reason: 'project-dir-replaced',
    })
  })

  it('emits runtime status updates when project residency changes', async () => {
    const root = await createTempRoot()
    const projectDir = join(root, 'project')
    await mkdir(projectDir, { recursive: true })

    const watcher = new ProjectWatcher(projectDir)
    ;(watcher as unknown as { initialized: boolean }).initialized = true
    ;(watcher as unknown as { projectDirFingerprint: string | null }).projectDirFingerprint = '1:1'

    const listener = vi.fn()
    watcher.subscribeRuntimeStatus(listener)

    await rm(projectDir, { recursive: true, force: true })
    ;(watcher as unknown as { checkPathLiveness: () => void }).checkPathLiveness()

    expect(listener).toHaveBeenCalled()
    expect(listener.mock.calls.at(-1)?.[0]).toMatchObject({
      projectResidency: {
        state: 'evicted',
        reason: 'missing-project-dir',
      },
    })
  })
})
