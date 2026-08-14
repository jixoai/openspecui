/**
 * Orthogonal intents (updated 2026-08-06 Asia/Shanghai):
 * 1. Prove the public Archive Router emits typed recompute lifecycle events.
 * 2. Prove replacement data follows its start event while the task is blocked.
 * 3. Prove replacement failure preserves the original error after its start event.
 * 4. Keep the fixed point inside the Planning-root owner and dispose every Windows transport owner.
 * 5. Reject stale Archive Instructions generation before Validate or Archive starts.
 *
 * Original request (2026-07-22): "整个过程中，几乎都在 Loading。"
 * Derived requirement (2026-07-22): Archive retains A while its reactive replacement computes B.
 * Review correction (2026-08-01): Archive inputs and mutation share one checked Root generation.
 * Original request (2026-08-04): "?????????macOS???????????Windows????????????"
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
  type CliStreamHandle,
  type CliStreamSettlement,
} from '@openspecui/core'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import { appRouter } from './router.js'
import {
  disposeServerTestFixture,
  removeServerTestDirectories,
  SERVER_FIXTURE_TEST_TIMEOUT_MS,
} from './server-test-cleanup.js'
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

function settledStreamHandle(exitCode: number | null): CliStreamHandle {
  const settlement: CliStreamSettlement = { reason: 'exited', exitCode }
  return {
    settled: Promise.resolve(settlement),
    cancel: () => Promise.resolve(settlement),
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
      await disposeServerTestFixture(server)
      await removeServerTestDirectories([tempDir])
    },
  }
}

describe(
  'public Archive projection subscription',
  { timeout: SERVER_FIXTURE_TEST_TIMEOUT_MS },
  () => {
    it('rejects stale Archive Instructions generation before strict validation starts', async () => {
      const fixture = await createArchiveRouterFixture()
      const validateStream = vi
        .spyOn(fixture.server.cliExecutor, 'validateStream')
        .mockImplementation((_options, onEvent) => {
          onEvent({ type: 'exit', exitCode: 0 })
          return settledStreamHandle(0)
        })
      const archiveStream = vi
        .spyOn(fixture.server.cliExecutor, 'archiveStream')
        .mockImplementation((_changeId, _options, onEvent) => {
          onEvent({ type: 'exit', exitCode: 0 })
          return settledStreamHandle(0)
        })

      try {
        const observable = await appRouter
          .createCaller(fixture.server.createContext())
          .cli.archiveStrictStream({
            changeId: 'add-search',
            expectedRootGeneration: 'stale-planning-generation',
          })

        await expect(
          new Promise<void>((resolve, reject) => {
            observable.subscribe({ complete: resolve, error: reject })
          })
        ).rejects.toMatchObject({ code: 'CONFLICT' })
        expect(validateStream).not.toHaveBeenCalled()
        expect(archiveStream).not.toHaveBeenCalled()
      } finally {
        await fixture.dispose()
      }
    })

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
  }
)
