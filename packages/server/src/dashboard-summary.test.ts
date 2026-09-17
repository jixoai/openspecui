/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove Dashboard Summary groups active Changes by exact tracked phase.
 * 2. Prove the existing archive facts produce bounded objective Kanban summaries.
 * 3. Prove the loader subtracts the CLI structural namespace-name set from its local
 *    Change listing (Kanban inherits the same inputs) and degrades to row retention
 *    when the planning CLI list is unavailable.
 *
 * Original request (2026-07-28): replace Dashboard Workflow Progress with ReadonlyKanban.
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — change-list nested/warnings projection (update-openspec-cli-1131 Slice 2).
 */
import {
  createDocumentChecklistSummary,
  createTrackedTaskProgress,
  OpenSpecAdapter,
  type ArchiveMeta,
  type CliChangeListFacts,
  type DashboardSummaryProjection,
} from '@openspecui/core'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DASHBOARD_RECENT_LIST_LIMIT } from '../../core/src/dashboard-display.js'
import {
  buildDashboardSummaryProjection,
  loadDashboardPlanningFacts,
  type DashboardPlanningFacts,
} from './dashboard-summary.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function trackedProgress(total: number, completed: number) {
  return createTrackedTaskProgress(
    Array.from({ length: total }, (_, index) => ({
      id: `task-${index + 1}`,
      text: `Task ${index + 1}`,
      completed: index < completed,
      location: { filePath: 'tasks.md', taskIndex: index + 1 },
    }))
  )
}

function archive(id: string, updatedAt: number): ArchiveMeta {
  return {
    id,
    name: id,
    trackedTaskProgress: trackedProgress(1, 1),
    documentChecklistSummary: createDocumentChecklistSummary([]),
    createdAt: updatedAt,
    updatedAt,
  }
}

describe('Dashboard objective Kanban summary', () => {
  it('counts exact active phases and bounds archives from the existing planning facts', () => {
    const progress = [trackedProgress(0, 0), trackedProgress(2, 0), trackedProgress(2, 2)]
    const facts: DashboardPlanningFacts = {
      specMetas: [],
      allSpecifications: [],
      allActiveChanges: progress.map((trackedTaskProgress, index) => ({
        id: `change-${index}`,
        name: `Change ${index}`,
        trackedTaskProgress,
        updatedAt: index,
      })),
      archiveMetas: Array.from({ length: DASHBOARD_RECENT_LIST_LIMIT + 2 }, (_, index) =>
        archive(`2026-07-${String(index + 1).padStart(2, '0')}-archive-${index}`, index)
      ),
    }

    const result: DashboardSummaryProjection = buildDashboardSummaryProjection(facts)

    expect(result.trackedTaskPhaseCounts).toEqual({
      'no-tasks': 1,
      'in-progress': 1,
      complete: 1,
    })
    expect(result.recentArchives).toHaveLength(DASHBOARD_RECENT_LIST_LIMIT)
    expect(result.recentArchives[0]?.id).toBe('2026-07-12-archive-11')
    expect(result.recentArchives[0]?.archivedAt).toBe(Date.UTC(2026, 6, 12))
  })
})

describe('Dashboard summary namespace subtraction (OpenSpec 1.13.1)', () => {
  /** Physical fixture: `area` wraps a nested change; `real-change` is a plain change. */
  async function createFixtureAdapter(): Promise<OpenSpecAdapter> {
    const root = await mkdtemp(join(tmpdir(), 'openspecui-dashboard-nested-'))
    tempDirs.push(root)
    await mkdir(join(root, 'openspec', 'changes', 'area', 'alpha'), { recursive: true })
    await mkdir(join(root, 'openspec', 'changes', 'real-change'), { recursive: true })
    return new OpenSpecAdapter(root)
  }

  function realChangeFacts(): CliChangeListFacts {
    return {
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
  }

  it('subtracts the namespace-name set from the local listing before building Active Changes inputs', async () => {
    const adapter = await createFixtureAdapter()
    const facts = await loadDashboardPlanningFacts({
      adapter,
      readCliChangeListFacts: async () => realChangeFacts(),
    })

    // Kanban and Active Changes consume these same inputs; the namespace directory never
    // becomes an input, so no surface downstream can render it as a change.
    expect(facts.allActiveChanges.map((change) => change.id)).toEqual(['real-change'])
    expect(facts.allActiveChanges[0]?.cliTaskSummary).toEqual({
      completedTasks: 2,
      totalTasks: 5,
      status: 'in-progress',
    })
  })

  it('keeps locally listed rows when the CLI list is unavailable (degradation contract)', async () => {
    const adapter = await createFixtureAdapter()
    const facts = await loadDashboardPlanningFacts({
      adapter,
      readCliChangeListFacts: async () => ({ entries: new Map(), namespaceNames: new Set() }),
    })

    // No CLI projection means no namespace set: rows remain visible with absent summaries.
    expect(facts.allActiveChanges.map((change) => change.id).sort()).toEqual([
      'area',
      'real-change',
    ])
    expect(facts.allActiveChanges.every((change) => change.cliTaskSummary == null)).toBe(true)
  })

  it('binds a real Change its own CLI summary when only a warning name collides (Round-B N3)', async () => {
    const adapter = await createFixtureAdapter()
    const facts = await loadDashboardPlanningFacts({
      adapter,
      readCliChangeListFacts: async () => ({
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
        // The hygiene warning names `area`, but no structural nested entry exists, so the
        // set is empty and the real change keeps its row with its own CLI facts.
        namespaceNames: new Set(),
      }),
    })

    const areaRow = facts.allActiveChanges.find((change) => change.id === 'area')
    expect(areaRow?.cliTaskSummary).toEqual({
      completedTasks: 2,
      totalTasks: 5,
      status: 'in-progress',
    })
  })
})
