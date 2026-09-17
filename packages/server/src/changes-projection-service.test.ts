/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove a slow later Change row cannot block an earlier batch.
 * 2. Prove row failures preserve completed rows and explicit progress.
 * 3. Prove a changed Planning-root generation cannot replay prior Change rows.
 * 4. Prove one-shot Change queries retire their listener before later invalidation.
 * 5. Prove the CLI's structural namespace-name set subtracts namespace directories from
 *    local-listing rows while CLI loss degrades to today's row-retention behavior.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — change-list nested/warnings projection (update-openspec-cli-1131 Slice 2).
 */
import type { ChangeMeta, CliChangeListFacts } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  ChangesProjectionService,
  createChangesProjectionWorkOwner,
  type ChangeProjectionAdapter,
  type ChangeProjectionEvent,
} from './changes-projection-service.js'
import type { ProjectionWorkIdentity } from './projection-work/index.js'
import { createServerProjectionWorkRuntime } from './projection-work/runtime.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  let rejectPromise: ((reason: unknown) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  if (!resolvePromise || !rejectPromise) throw new Error('Deferred resolver was not initialized.')
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

function createChange(id: string, updatedAt: number): ChangeMeta {
  return {
    id,
    name: id,
    trackedTaskProgress: {
      tasks: [],
      total: 0,
      completed: 0,
      remaining: 0,
      phase: 'no-tasks',
      source: { kind: 'none', artifactId: null, outputPath: null, filePaths: [] },
    },
    documentChecklistSummary: { groups: [], total: 0, completed: 0, remaining: 0 },
    createdAt: updatedAt,
    updatedAt,
    cliTaskSummary: null,
  }
}

function createRowsIdentity(): ProjectionWorkIdentity {
  return {
    projectionKind: 'changes-rows',
    planningRoot: { identity: '/planning-root', source: 'nearest', storeSelector: null },
    owner: { generation: 'planning-generation-a', gitBindingToken: null },
    selector: 'changes:list-with-meta',
    inputFingerprint: 'reactive-filesystem:changes-v1',
    protocolVersion: 1,
  }
}

function createService(options: {
  owner: ReturnType<typeof createChangesProjectionWorkOwner>
  adapter: ChangeProjectionAdapter
  generation?: string
}) {
  return new ChangesProjectionService({
    workOwner: options.owner,
    root: {
      path: '/planning-root',
      source: 'nearest',
      storeSelector: null,
      generation: options.generation ?? 'planning-generation-a',
    },
    adapter: options.adapter,
  })
}

function receivedBatches(events: ChangeProjectionEvent[]) {
  return events.filter((event) => event.type === 'batch')
}

describe('ChangesProjectionService', () => {
  it('emits the first completed row before a later slow row settles', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createChangesProjectionWorkOwner(runtime)
    const slowB = createDeferred<ChangeMeta>()
    const adapter: ChangeProjectionAdapter = {
      listChanges: vi.fn(async () => ['a', 'b']),
      readChangeMeta: vi.fn((id: string) =>
        id === 'a' ? Promise.resolve(createChange('a', 1)) : slowB.promise
      ),
    }
    const service = createService({ owner, adapter })
    const events: ChangeProjectionEvent[] = []
    const subscription = service.subscribe((event) => events.push(event))

    await vi.waitFor(() => {
      expect(receivedBatches(events)).toContainEqual(
        expect.objectContaining({
          batch: expect.objectContaining({ rows: [createChange('a', 1)] }),
          progress: { completed: 1, total: 2 },
        })
      )
    })
    expect(events.some((event) => event.type === 'snapshot')).toBe(false)

    slowB.resolve(createChange('b', 2))
    await vi.waitFor(() => {
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'snapshot',
          snapshot: expect.objectContaining({
            data: expect.objectContaining({ rows: [createChange('b', 2), createChange('a', 1)] }),
          }),
        })
      )
    })

    subscription.unsubscribe()
    service.dispose()
    runtime.clear()
  })

  it('retains completed rows and reports a row error when a later mapper fails', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createChangesProjectionWorkOwner(runtime)
    const adapter: ChangeProjectionAdapter = {
      listChanges: vi.fn(async () => ['a', 'broken']),
      readChangeMeta: vi.fn((id: string) => {
        if (id === 'a') return Promise.resolve(createChange('a', 1))
        return Promise.reject(new Error('broken row'))
      }),
    }
    const service = createService({ owner, adapter })
    const result = await service.getCurrent()

    expect(result.rows).toEqual([createChange('a', 1)])
    expect(result.errors).toEqual([{ changeId: 'broken', message: 'broken row' }])

    service.dispose()
    runtime.clear()
  })

  it('retires a one-shot Change query before later invalidation', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createChangesProjectionWorkOwner(runtime)
    const adapter: ChangeProjectionAdapter = {
      listChanges: vi.fn(async () => ['a']),
      readChangeMeta: vi.fn(async () => createChange('a', 1)),
    }
    const service = createService({ owner, adapter })

    await service.getCurrent()
    owner.rows.invalidate(createRowsIdentity())
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 20))

    expect(adapter.listChanges).toHaveBeenCalledOnce()

    service.dispose()
    runtime.clear()
  })

  it('does not reuse Change A rows after the Planning-root generation changes to B', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createChangesProjectionWorkOwner(runtime)
    const loadA = vi.fn(async () => createChange('a', 1))
    const loadB = vi.fn(async () => createChange('b', 2))
    const adapterA: ChangeProjectionAdapter = {
      listChanges: vi.fn(async () => ['a']),
      readChangeMeta: loadA,
    }
    const adapterB: ChangeProjectionAdapter = {
      listChanges: vi.fn(async () => ['b']),
      readChangeMeta: loadB,
    }
    const serviceA = createService({
      owner,
      adapter: adapterA,
      generation: 'planning-generation-a',
    })
    const serviceB = createService({
      owner,
      adapter: adapterB,
      generation: 'planning-generation-b',
    })

    await serviceA.getCurrent()
    const resultB = await serviceB.getCurrent()

    expect(resultB.rows).toEqual([createChange('b', 2)])
    expect(loadA).toHaveBeenCalledOnce()
    expect(loadB).toHaveBeenCalledOnce()

    serviceA.dispose()
    serviceB.dispose()
    runtime.clear()
  })

  it('subtracts the CLI structural namespace-name set from local-listing rows', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createChangesProjectionWorkOwner(runtime)
    const facts: CliChangeListFacts = {
      entries: new Map([
        [
          'real-change',
          {
            name: 'real-change',
            completedTasks: 2,
            totalTasks: 5,
            lastModified: '2026-09-17T00:00:00.000Z',
            status: 'in-progress',
          },
        ],
      ]),
      namespaceNames: new Set(['area']),
    }
    const adapter: ChangeProjectionAdapter = {
      listChanges: vi.fn(async () => ['area', 'real-change']),
      readChangeMeta: vi.fn((id: string) => Promise.resolve(createChange(id, 1))),
      readCliChangeListFacts: vi.fn(async () => facts),
    }
    const service = createService({ owner, adapter })
    const result = await service.getCurrent()

    // The namespace directory has no row at all: no detail route, no Tasks 0/0.
    expect(result.rows.map((row) => row.id)).toEqual(['real-change'])
    expect(result.rows[0]?.cliTaskSummary).toEqual({
      completedTasks: 2,
      totalTasks: 5,
      status: 'in-progress',
    })

    service.dispose()
    runtime.clear()
  })

  it('keeps local rows on CLI-list loss instead of gating row visibility', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createChangesProjectionWorkOwner(runtime)
    const adapter: ChangeProjectionAdapter = {
      listChanges: vi.fn(async () => ['area', 'real-change']),
      readChangeMeta: vi.fn((id: string) => Promise.resolve(createChange(id, 1))),
      // No readCliChangeListFacts: the planning CLI projection is unavailable, so there is
      // no namespace set to subtract and rows keep today's behavior with null summaries.
    }
    const service = createService({ owner, adapter })
    const result = await service.getCurrent()

    expect(result.rows.map((row) => row.id).sort()).toEqual(['area', 'real-change'])
    expect(result.rows.every((row) => row.cliTaskSummary === null)).toBe(true)

    service.dispose()
    runtime.clear()
  })

  it('binds a real Change its own CLI summary when only a warning name collides (Round-B N3)', async () => {
    const runtime = createServerProjectionWorkRuntime()
    const owner = createChangesProjectionWorkOwner(runtime)
    // `area` is a real change the CLI listed with its own counts; the hygiene warning that
    // mentions `area` has no structurally-nested entry behind it, so nothing is subtracted
    // and the join must use the real change's own facts, never a namespace 0/0.
    const facts: CliChangeListFacts = {
      entries: new Map([
        [
          'area',
          {
            name: 'area',
            completedTasks: 2,
            totalTasks: 5,
            lastModified: '2026-09-17T00:00:00.000Z',
            status: 'in-progress',
          },
        ],
      ]),
      namespaceNames: new Set(),
    }
    const adapter: ChangeProjectionAdapter = {
      listChanges: vi.fn(async () => ['area']),
      readChangeMeta: vi.fn(async () => createChange('area', 1)),
      readCliChangeListFacts: vi.fn(async () => facts),
    }
    const service = createService({ owner, adapter })
    const result = await service.getCurrent()

    expect(result.rows.map((row) => row.id)).toEqual(['area'])
    expect(result.rows[0]?.cliTaskSummary).toEqual({
      completedTasks: 2,
      totalTasks: 5,
      status: 'in-progress',
    })

    service.dispose()
    runtime.clear()
  })
})
