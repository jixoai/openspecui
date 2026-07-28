/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Map exact OpenSpec task phases and archive stage to objective Kanban lanes.
 * 2. Derive lane counts and archive-range rows without owning presentation or operations.
 *
 * Original request (2026-07-28): keep PR #208 open to OPSX schemas and replace Dashboard Workflow Progress.
 */
import {
  isArchiveInRange,
  resolveArchiveTimestamp,
  type DashboardArchiveRange,
} from '@openspecui/core/dashboard-display'
import type { TrackedTaskPhase, TrackedTaskProgress } from '@openspecui/core/task-progress'

export type ActiveKanbanLaneId = TrackedTaskPhase
export type KanbanLaneId = ActiveKanbanLaneId | 'archived'

export interface KanbanActiveItem {
  id: string
  name: string
  trackedTaskProgress: TrackedTaskProgress
  updatedAt: number
}

export interface KanbanArchiveItem extends KanbanActiveItem {
  archivedAt?: number
}

export interface KanbanLaneDefinition {
  id: KanbanLaneId
  label: string
  shortLabel: string
  accentClass: string
}

export const KANBAN_LANES: readonly KanbanLaneDefinition[] = [
  {
    id: 'no-tasks',
    label: 'No tracked tasks',
    shortLabel: 'No tasks',
    accentClass: 'bg-muted-foreground/55',
  },
  {
    id: 'in-progress',
    label: 'Tasks remaining',
    shortLabel: 'Remaining',
    accentClass: 'bg-primary',
  },
  {
    id: 'complete',
    label: 'Tasks complete',
    shortLabel: 'Complete',
    accentClass: 'bg-emerald-500',
  },
  {
    id: 'archived',
    label: 'Archived',
    shortLabel: 'Archived',
    accentClass: 'bg-accent',
  },
]

/** Group active rows by the exact upstream tracked-task phase. */
export function groupActiveKanbanItems(
  items: readonly KanbanActiveItem[]
): Record<ActiveKanbanLaneId, KanbanActiveItem[]> {
  const groups: Record<ActiveKanbanLaneId, KanbanActiveItem[]> = {
    'no-tasks': [],
    'in-progress': [],
    complete: [],
  }
  for (const item of items) groups[item.trackedTaskProgress.phase].push(item)
  return groups
}

/** Count the exact task-phase populations without inferring workflow readiness. */
export function countActiveKanbanPhases(
  items: readonly KanbanActiveItem[]
): Record<ActiveKanbanLaneId, number> {
  const groups = groupActiveKanbanItems(items)
  return {
    'no-tasks': groups['no-tasks'].length,
    'in-progress': groups['in-progress'].length,
    complete: groups.complete.length,
  }
}

/** Select archived rows for one range and keep newest objective archive dates first. */
export function filterKanbanArchives(
  items: readonly KanbanArchiveItem[],
  range: DashboardArchiveRange,
  now = Date.now()
): KanbanArchiveItem[] {
  return items
    .filter((item) => isArchiveInRange(item, range, now))
    .sort(
      (left, right) =>
        resolveArchiveTimestamp(right) - resolveArchiveTimestamp(left) ||
        left.id.localeCompare(right.id)
    )
}

/** Resolve the date displayed for an archive summary. */
export function getKanbanArchiveTimestamp(item: KanbanArchiveItem): number {
  return item.archivedAt ?? resolveArchiveTimestamp(item)
}
