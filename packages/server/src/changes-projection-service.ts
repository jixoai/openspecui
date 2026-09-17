/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Own progressive active-Change row projection for the current Planning root.
 * 2. Emit bounded rows and explicit progress before later rows settle.
 * 3. Preserve completed rows and row-level errors while a batch continues.
 * 4. Bind cached work to Planning-root generation and reactive filesystem invalidation.
 * 5. Subtract the CLI's structural namespace-name set from the local listing (OpenSpec
 *    1.13.1) so namespace folders never become rows; CLI loss keeps today's row-retention
 *    behavior instead of gating row visibility.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — change-list nested/warnings projection (update-openspec-cli-1131 Slice 2).
 */
import type {
  ChangeMeta,
  ChangeProjectionBatch,
  ChangeProjectionData,
  ChangeProjectionRowError,
  CliChangeListFacts,
} from '@openspecui/core'
import { Buffer } from 'node:buffer'
import {
  ProjectionWorkRegistry,
  type ProjectionWorkEvent,
  type ProjectionWorkIdentity,
  type ProjectionWorkRequest,
  type ProjectionWorkRuntime,
  type ProjectionWorkSubscription,
} from './projection-work/index.js'

/**
 * CLI-reported task facts for the list, keyed by Change id, plus the structural
 * namespace-name set (OpenSpec 1.13.1). Sourced once from the `openspec list` projection —
 * the CLI is the task-count authority, UI-side file arithmetic must never backfill a
 * missing entry, and the namespace set is the kernel's single structural derivation
 * (never re-derived from warning message text here).
 */
export type CliTaskSummaryIndex = CliChangeListFacts

/** Minimal adapter boundary needed by the progressive list; workflow facts stay out of this projection. */
export interface ChangeProjectionAdapter {
  listChanges(): Promise<string[]>
  readChangeMeta(id: string): Promise<ChangeMeta>
  /**
   * Read the CLI-owned Change-list facts (actionable entries plus the structural
   * namespace-name set) when the planning CLI projection is available. Implementations
   * return empty facts (never a rejection) when the CLI list is not observable, so the
   * progressive list stays file-driven, rows simply carry null summaries, and locally
   * listed rows — including namespace directories — remain visible (degradation contract).
   */
  readCliChangeListFacts?(): Promise<CliChangeListFacts>
}

/** Complete Planning-root provenance used for one active Change-list Work identity. */
export interface ChangesProjectionRoot {
  path: string
  source: string
  storeSelector: string | null
  generation: string
}

export type ChangeProjectionEvent = ProjectionWorkEvent<ChangeProjectionData, ChangeProjectionBatch>

export type {
  ChangeProjectionBatch,
  ChangeProjectionData,
  ChangeProjectionRowError,
} from '@openspecui/core'

export interface ChangesProjectionWorkOwner {
  readonly rows: ProjectionWorkRegistry<ChangeProjectionData, ChangeProjectionBatch>
}

/** Create the typed Changes registry inside an existing Server Projection Work runtime. */
export function createChangesProjectionWorkOwner(
  runtime: ProjectionWorkRuntime
): ChangesProjectionWorkOwner {
  return { rows: runtime.createRegistry<ChangeProjectionData, ChangeProjectionBatch>() }
}

export interface ChangesProjectionServiceOptions {
  workOwner: ChangesProjectionWorkOwner
  root: ChangesProjectionRoot
  adapter: ChangeProjectionAdapter
}

export interface ChangesProjectionServiceContract {
  subscribe(listener: (event: ChangeProjectionEvent) => void): ProjectionWorkSubscription
  getCurrent(): Promise<ChangeProjectionData>
  dispose(): void
}

function estimateSnapshotBytes(data: ChangeProjectionData): number {
  return Buffer.byteLength(JSON.stringify(data) ?? '', 'utf8')
}

function normalizeRowError(changeId: string, cause: unknown): ChangeProjectionRowError {
  return {
    changeId,
    message: cause instanceof Error ? cause.message : String(cause),
  }
}

/** Server-owned progressive Change list projection. */
export class ChangesProjectionService implements ChangesProjectionServiceContract {
  private readonly subscriptions = new Set<ProjectionWorkSubscription>()
  private disposed = false

  constructor(private readonly options: ChangesProjectionServiceOptions) {}

  subscribe(listener: (event: ChangeProjectionEvent) => void): ProjectionWorkSubscription {
    if (this.disposed) throw new Error('Changes projection service is disposed.')
    const subscription = this.options.workOwner.rows.subscribe(this.request(), listener)
    this.subscriptions.add(subscription)
    let active = true
    return {
      unsubscribe: () => {
        if (!active) return
        active = false
        this.subscriptions.delete(subscription)
        subscription.unsubscribe()
      },
    }
  }

  getCurrent(): Promise<ChangeProjectionData> {
    return new Promise((resolve, reject) => {
      let settled = false
      let subscription: ProjectionWorkSubscription | null = null
      const settle = (callback: () => void) => {
        if (settled) return
        settled = true
        try {
          callback()
        } finally {
          subscription?.unsubscribe()
        }
      }
      subscription = this.subscribe((event) => {
        if (event.type === 'snapshot' && event.snapshot.freshness === 'current') {
          settle(() => resolve(event.snapshot.data))
          return
        }
        if (event.type === 'failed') settle(() => reject(event.error))
      })
      if (settled) subscription.unsubscribe()
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const subscription of this.subscriptions) subscription.unsubscribe()
    this.subscriptions.clear()
  }

  private identity(): ProjectionWorkIdentity {
    return {
      projectionKind: 'changes-rows',
      planningRoot: {
        identity: this.options.root.path,
        source: this.options.root.source,
        storeSelector: this.options.root.storeSelector,
      },
      owner: { generation: this.options.root.generation, gitBindingToken: null },
      selector: 'changes:list-with-meta',
      inputFingerprint: 'reactive-filesystem:changes-v1',
      protocolVersion: 1,
    }
  }

  private request(): ProjectionWorkRequest<ChangeProjectionData, ChangeProjectionBatch> {
    return {
      identity: this.identity(),
      resourceClass: 'filesystem',
      priority: 'foreground',
      estimateSnapshotBytes,
      load: async (context) => {
        context.reportStage('root-ready')
        const ids = await this.options.adapter.listChanges()
        // Join the CLI's own task counts once per load; a missing CLI list leaves every
        // row null rather than fabricating counts from local checkbox arithmetic. The same
        // read carries the structural namespace-name set: OpenSpec 1.13.1 namespace folders
        // are subtracted from the row inventory here (the single subtraction point for this
        // projection), while an unavailable CLI list subtracts nothing — rows stay visible.
        const cliFacts =
          (await this.options.adapter.readCliChangeListFacts?.()) ??
          ({ entries: new Map(), namespaceNames: new Set() } satisfies CliChangeListFacts)
        const rowIds = ids.filter((id) => !cliFacts.namespaceNames.has(id))
        const rows: ChangeMeta[] = []
        const errors: ChangeProjectionRowError[] = []
        const total = rowIds.length

        for (const [index, id] of rowIds.entries()) {
          if (context.signal.aborted)
            throw new DOMException('Change projection was cancelled.', 'AbortError')
          try {
            const meta = await this.options.adapter.readChangeMeta(id)
            const entry = cliFacts.entries.get(id)
            const row: ChangeMeta = entry
              ? {
                  ...meta,
                  cliTaskSummary: {
                    completedTasks: entry.completedTasks,
                    totalTasks: entry.totalTasks,
                    status: entry.status,
                  },
                }
              : { ...meta, cliTaskSummary: meta.cliTaskSummary ?? null }
            rows.push(row)
            context.emitBatch(
              { rows: [row], errors: [], progress: { completed: index + 1, total } },
              { completed: index + 1, total }
            )
          } catch (error: unknown) {
            const rowError = normalizeRowError(id, error)
            errors.push(rowError)
            context.emitBatch(
              { rows: [], errors: [rowError], progress: { completed: index + 1, total } },
              { completed: index + 1, total }
            )
          }
        }

        context.reportStage('leaf-settled')
        return {
          rows: rows.sort((left, right) => right.updatedAt - left.updatedAt),
          errors,
        }
      },
    }
  }
}
