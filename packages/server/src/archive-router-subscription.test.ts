/**
 * Orthogonal intents (created 2026-07-22 Asia/Shanghai):
 * 1. Prove the public Archive Router emits typed recompute lifecycle events.
 * 2. Prove replacement data follows its start event while the task is blocked.
 * 3. Prove replacement failure preserves the original error after its start event.
 * 4. Keep the fixed point inside the Planning-root owner and checked transport lane.
 *
 * Original request (2026-07-22): "整个过程中，几乎都在 Loading。"
 * Derived requirement (2026-07-22): Archive retains A while its reactive replacement computes B.
 */
import {
  CliContextSchema,
  CliDoctorSchema,
  createDocumentChecklistSummary,
  createTrackedTaskProgress,
  OpenSpecAdapter,
  parseCliCommandResult,
  ReactiveState,
  type ArchiveMeta,
  type CliCommandResult,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import { createServer } from './server.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason?: unknown): void
}

type ArchiveProjectionEvent = { type: 'recompute-started' } | { type: 'data'; data: ArchiveMeta[] }

function parseArchiveProjectionEvent(event: ArchiveProjectionEvent): ArchiveProjectionEvent {
  if (!('type' in event)) {
    throw new Error('Archive Router must emit reactive projection events.')
  }
  return event
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  let rejectPromise: ((reason?: unknown) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return {
    promise,
    resolve(value) {
      if (!resolvePromise) throw new Error('Deferred resolver was not initialized.')
      resolvePromise(value)
    },
    reject(reason) {
      if (!rejectPromise) throw new Error('Deferred rejecter was not initialized.')
      rejectPromise(reason)
    },
  }
}

function commandResult<T>(data: T, schema: ZodType<T>): CliCommandResult<T> {
  return parseCliCommandResult(
    {
      success: true,
      stdout: JSON.stringify(data),
      stderr: '',
      exitCode: 0,
    },
    schema
  )
}

function archive(id: string, updatedAt: number): ArchiveMeta {
  return {
    id,
    name: id,
    trackedTaskProgress: createTrackedTaskProgress([]),
    documentChecklistSummary: createDocumentChecklistSummary([]),
    createdAt: updatedAt,
    updatedAt,
  }
}

async function createArchiveRouterFixture() {
  const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-archive-router-'))
  const launchRoot = join(tempDir, 'launch')
  const planningRoot = join(tempDir, 'planning')
  await Promise.all(
    [launchRoot, planningRoot].map((root) => mkdir(join(root, 'openspec'), { recursive: true }))
  )

  const server = createServer({ projectDir: launchRoot, enableWatcher: false })
  vi.spyOn(server.cliExecutor, 'checkAvailability').mockResolvedValue({
    available: true,
    version: '1.6.0',
  })
  vi.spyOn(server.cliExecutor.contracts, 'doctorRoot').mockResolvedValue(
    commandResult(
      {
        root: {
          path: planningRoot,
          source: 'declared',
          store_id: 'planning-store',
          healthy: true,
          status: [],
        },
        store: {
          id: 'planning-store',
          metadata: { present: true, valid: true },
          status: [],
        },
        references: [],
        status: [],
      },
      CliDoctorSchema
    )
  )
  vi.spyOn(server.cliExecutor.contracts, 'context').mockResolvedValue(
    commandResult(
      {
        root: {
          path: planningRoot,
          source: 'declared',
          store_id: 'planning-store',
          role: 'openspec_root',
        },
        members: [],
        status: [],
      },
      CliContextSchema
    )
  )

  return {
    server,
    async dispose() {
      vi.restoreAllMocks()
      await server.storeObservationFallback.dispose()
      await server.planningRootServices.dispose()
      await server.storeObservation.dispose()
      await server.dataHomeObserver.dispose()
      await server.toolCommandObservation.dispose()
      server.storeInvalidation.dispose()
      server.projectInvalidation.dispose()
      await server.observationEnvironment.dispose()
      server.projectRecoveryService.dispose()
      server.translationCacheService.close()
      await rm(tempDir, { recursive: true, force: true })
    },
  }
}

describe('public Archive projection subscription', () => {
  it('emits A, replacement start, then B through the Planning-root Router endpoint', async () => {
    const fixture = await createArchiveRouterFixture()
    const source = new ReactiveState<'A' | 'B'>('A')
    const replacementEntered = createDeferred<void>()
    const releaseReplacement = createDeferred<void>()
    const initialData = createDeferred<void>()
    const replacementData = createDeferred<void>()
    const events: ArchiveProjectionEvent[] = []
    const errors: unknown[] = []
    let taskRuns = 0
    let subscription: { unsubscribe(): void } | null = null

    vi.spyOn(OpenSpecAdapter.prototype, 'listArchivedChangesWithMeta').mockImplementation(
      async () => {
        taskRuns += 1
        const value = source.get()
        if (taskRuns > 1) {
          replacementEntered.resolve()
          await releaseReplacement.promise
        }
        return value === 'A' ? [archive('archive-a', 1)] : [archive('archive-b', 2)]
      }
    )

    try {
      const observable = await appRouter
        .createCaller(fixture.server.createContext())
        .archive.subscribe()
      subscription = observable.subscribe({
        next(event) {
          let projectionEvent: ArchiveProjectionEvent
          try {
            projectionEvent = parseArchiveProjectionEvent(event)
          } catch (error) {
            initialData.reject(error)
            return
          }
          events.push(projectionEvent)
          if (projectionEvent.type === 'data' && projectionEvent.data[0]?.id === 'archive-a') {
            initialData.resolve()
          }
          if (projectionEvent.type === 'data' && projectionEvent.data[0]?.id === 'archive-b') {
            replacementData.resolve()
          }
        },
        error(error) {
          errors.push(error)
          initialData.reject(error)
          replacementEntered.reject(error)
          replacementData.reject(error)
        },
      })

      await initialData.promise
      expect(events).toEqual([{ type: 'data', data: [archive('archive-a', 1)] }])

      source.set('B')
      await replacementEntered.promise
      expect(events).toEqual([
        { type: 'data', data: [archive('archive-a', 1)] },
        { type: 'recompute-started' },
      ])

      releaseReplacement.resolve()
      await replacementData.promise
      expect(events).toEqual([
        { type: 'data', data: [archive('archive-a', 1)] },
        { type: 'recompute-started' },
        { type: 'data', data: [archive('archive-b', 2)] },
      ])
      expect(errors).toEqual([])
    } finally {
      releaseReplacement.resolve()
      subscription?.unsubscribe()
      await fixture.dispose()
    }
  })

  it('emits replacement start before preserving the original Router task error', async () => {
    const fixture = await createArchiveRouterFixture()
    const source = new ReactiveState<'ready' | 'failed'>('ready')
    const initialData = createDeferred<void>()
    const replacementEntered = createDeferred<void>()
    const rejected = createDeferred<void>()
    const rejection = new Error('archive replacement failed')
    const events: ArchiveProjectionEvent[] = []
    const errors: unknown[] = []
    let subscription: { unsubscribe(): void } | null = null

    vi.spyOn(OpenSpecAdapter.prototype, 'listArchivedChangesWithMeta').mockImplementation(
      async () => {
        const value = source.get()
        if (value === 'failed') {
          replacementEntered.resolve()
          throw rejection
        }
        return [archive('archive-a', 1)]
      }
    )

    try {
      const observable = await appRouter
        .createCaller(fixture.server.createContext())
        .archive.subscribe()
      subscription = observable.subscribe({
        next(event) {
          let projectionEvent: ArchiveProjectionEvent
          try {
            projectionEvent = parseArchiveProjectionEvent(event)
          } catch (error) {
            initialData.reject(error)
            return
          }
          events.push(projectionEvent)
          if (projectionEvent.type === 'data') initialData.resolve()
        },
        error(error) {
          errors.push(error)
          rejected.resolve()
        },
      })

      await initialData.promise
      source.set('failed')
      await replacementEntered.promise
      await rejected.promise

      expect(events).toEqual([
        { type: 'data', data: [archive('archive-a', 1)] },
        { type: 'recompute-started' },
      ])
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe(rejection)
    } finally {
      subscription?.unsubscribe()
      await fixture.dispose()
    }
  })
})
