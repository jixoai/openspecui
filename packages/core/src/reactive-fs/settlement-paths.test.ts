/**
 * Orthogonal intents (created 2026-11-05 Asia/Shanghai):
 * 1. Pin `settlePaths` as the one-shot freshness primitive of fix-reactive-fs-settlement S4:
 *    pool- and lease-independent, awaited, amount-returning, and non-destructive.
 * 2. Equivalence: with no lease and no native watcher, a second one-shot read observes an external
 *    write only because the awaited settle re-read the input roots first.
 * 3. Orphan boundary: a retained projection alive across a one-shot read of the same root keeps its
 *    registrations and still converges through a later settlement.
 * 4. Empty input reads nothing; a settle never shrinks the registry.
 *
 * Original request (2026-11-04): "关于'已知缺口'和需要我决策的问题。请白话解释一下"
 * Owner decision (2026-11-04): "修肯定是要修的，只不过你手工打补丁的方式肯定不如社区成熟度高的方案"
 *   — fix-reactive-fs-settlement S4 (S5.3c, CP4) and its V3 path-space validation.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.spyOn` cannot redefine ESM namespace exports, so module spies are installed as mocks that
// keep the real implementations and only record calls — the same technique as
// `settlement-coverage.test.ts`, so the zero-call evidence below is interception, not absence.
vi.mock('node:fs', { spy: true })
vi.mock('node:fs/promises', { spy: true })

import { cleanupTempDir, createTempDir } from '../__tests__/test-utils.js'
import { createToolInitStateProjection, getToolInitStates } from '../tool-init-state.js'
import {
  ReactiveContext,
  clearCache,
  closeAllWatchers,
  getCacheSize,
  getSettlementDiagnostics,
  getWatcherRuntimeStatus,
  reactiveReadDir,
  reactiveReadFile,
  settlePaths,
} from './index.js'

describe('settlePaths: one-shot freshness without orphaning', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await createTempDir()
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  it('refreshes a registered read through an awaited settle with no lease in the process', async () => {
    const filePath = join(tempDir, 'artifact.txt')
    await writeFile(filePath, 'before', 'utf8')
    await expect(reactiveReadFile(filePath)).resolves.toBe('before')

    // No lease and no pooled interval: nothing except a settlement can see the write below, so the
    // stale read is the positive control that this fixture really has no event path.
    expect(getWatcherRuntimeStatus()).toBeNull()
    expect(getSettlementDiagnostics().activeTimers).toBe(0)

    await writeFile(filePath, 'after', 'utf8')
    await expect(reactiveReadFile(filePath)).resolves.toBe('before')

    await expect(settlePaths([tempDir])).resolves.toBe(1)
    await expect(reactiveReadFile(filePath)).resolves.toBe('after')
  })

  it('covers each deduplicated normalized root once', async () => {
    const filePath = join(tempDir, 'dedup.txt')
    await writeFile(filePath, 'v1', 'utf8')
    await expect(reactiveReadFile(filePath)).resolves.toBe('v1')

    // Exactly one registration exists; an implementation that settled the repeated root twice
    // would report 2 here.
    await expect(settlePaths([tempDir, tempDir])).resolves.toBe(1)
  })

  it('keeps a retained projection observable across a one-shot read of the same root', async () => {
    const context = new ReactiveContext()
    const projection = context.stream(
      createToolInitStateProjection(tempDir, { delivery: 'skills', workflows: ['explore'] })
    )

    try {
      const initial = await projection.next()
      expect(initial.done).toBe(false)
      expect(initial.value.find((entry) => entry.toolId === 'claude')?.status).toBe('uninitialized')

      // The real one-shot consumer reads the same root. Its settling must not retire the retained
      // projection's registrations — the reachable orphan channel this slice removes.
      const oneShot = await getToolInitStates(tempDir, {
        delivery: 'skills',
        workflows: ['explore'],
      })
      expect(oneShot.find((entry) => entry.toolId === 'claude')?.status).toBe('uninitialized')

      await mkdir(join(tempDir, '.claude', 'skills', 'openspec-explore'), { recursive: true })
      await writeFile(
        join(tempDir, '.claude', 'skills', 'openspec-explore', 'SKILL.md'),
        '---\nmetadata:\n  generatedBy: "1.16.1"\n---\n',
        'utf8'
      )

      // Still no lease and no timer, so only the settlement can serve the retained projection.
      expect(getWatcherRuntimeStatus()).toBeNull()
      expect(getSettlementDiagnostics().activeTimers).toBe(0)

      const committed = await settlePaths([tempDir])
      expect(committed).toBeGreaterThanOrEqual(1)
      // The count is the real commit count: the same registrations settle again, none were removed.
      await expect(settlePaths([tempDir])).resolves.toBe(committed)

      const replacement = await projection.next()
      expect(replacement.done).toBe(false)
      expect(replacement.value.find((entry) => entry.toolId === 'claude')?.status).toBe(
        'initialized'
      )
    } finally {
      await projection.return(undefined)
    }
  })

  it('performs zero filesystem reads for an empty list and for a root with no registered reads', async () => {
    const fsPromises = await import('node:fs/promises')
    const readFileSpy = vi.mocked(fsPromises.readFile)
    const readdirSpy = vi.mocked(fsPromises.readdir)
    const statSpy = vi.mocked(fsPromises.stat)
    readFileSpy.mockClear()
    readdirSpy.mockClear()
    statSpy.mockClear()

    await expect(settlePaths([])).resolves.toBe(0)
    await expect(settlePaths([join(tempDir, 'no-registered-reads')])).resolves.toBe(0)

    expect(readFileSpy).not.toHaveBeenCalled()
    expect(readdirSpy).not.toHaveBeenCalled()
    expect(statSpy).not.toHaveBeenCalled()

    // Positive control: the spies observe the very reads a settlement reuses.
    const probeFile = join(tempDir, 'probe.txt')
    await writeFile(probeFile, 'content', 'utf8')
    await expect(reactiveReadFile(probeFile)).resolves.toBe('content')
    await expect(settlePaths([tempDir])).resolves.toBe(1)
    expect(readFileSpy).toHaveBeenCalled()
  })

  it('never removes registrations: the cache size holds and the same registrations keep settling', async () => {
    const filePath = join(tempDir, 'kept.txt')
    const dirPath = join(tempDir, 'kept-dir')
    await mkdir(dirPath)
    await writeFile(filePath, 'v1', 'utf8')
    await expect(reactiveReadFile(filePath)).resolves.toBe('v1')
    await expect(reactiveReadDir(dirPath)).resolves.toEqual([])

    const sizeBeforeSettle = getCacheSize()
    expect(sizeBeforeSettle).toBeGreaterThanOrEqual(2)

    await writeFile(filePath, 'v2', 'utf8')
    await expect(settlePaths([tempDir])).resolves.toBeGreaterThanOrEqual(2)

    expect(getCacheSize()).toBe(sizeBeforeSettle)
    await expect(reactiveReadFile(filePath)).resolves.toBe('v2')
  })
})
