/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove Dashboard Summary groups active Changes by exact tracked phase.
 * 2. Prove the existing archive facts produce bounded objective Kanban summaries.
 *
 * Original request (2026-07-28): replace Dashboard Workflow Progress with ReadonlyKanban.
 */
import {
  createDocumentChecklistSummary,
  createTrackedTaskProgress,
  type ArchiveMeta,
  type DashboardSummaryProjection,
} from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { DASHBOARD_RECENT_LIST_LIMIT } from '../../core/src/dashboard-display.js'
import {
  buildDashboardSummaryProjection,
  type DashboardPlanningFacts,
} from './dashboard-summary.js'

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
