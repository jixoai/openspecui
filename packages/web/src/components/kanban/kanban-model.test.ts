/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove objective lane grouping follows exact tracked phases.
 * 2. Prove archive range filtering and ordering share Core date semantics.
 *
 * Original request (2026-07-28): keep PR #208 open to OPSX schemas.
 */
import { createTrackedTaskProgress } from '@openspecui/core/task-progress'
import { describe, expect, it } from 'vitest'
import {
  countActiveKanbanPhases,
  filterKanbanArchives,
  groupActiveKanbanItems,
} from './kanban-model'

function item(id: string, total: number, completed: number, updatedAt = 0) {
  return {
    id,
    name: id,
    updatedAt,
    trackedTaskProgress: createTrackedTaskProgress(
      Array.from({ length: total }, (_, index) => ({
        id: `${id}-${index}`,
        text: `Task ${index}`,
        completed: index < completed,
        location: { filePath: 'tasks.md', taskIndex: index + 1 },
      }))
    ),
  }
}

describe('objective Kanban model', () => {
  it('keeps no-tasks separate and groups zero-complete tracked work as in-progress', () => {
    const items = [item('none', 0, 0), item('zero-of-two', 2, 0), item('done', 2, 2)]

    expect(groupActiveKanbanItems(items)).toMatchObject({
      'no-tasks': [{ id: 'none' }],
      'in-progress': [{ id: 'zero-of-two' }],
      complete: [{ id: 'done' }],
    })
    expect(countActiveKanbanPhases(items)).toEqual({
      'no-tasks': 1,
      'in-progress': 1,
      complete: 1,
    })
  })

  it('filters and orders archives by the shared objective date policy', () => {
    const now = Date.UTC(2026, 6, 28)
    const rows = [
      item('2026-07-22-beta', 1, 1),
      item('2026-07-01-old', 1, 1),
      item('2026-07-22-alpha', 1, 1),
    ]

    expect(filterKanbanArchives(rows, '7d', now).map((row) => row.id)).toEqual([
      '2026-07-22-alpha',
      '2026-07-22-beta',
    ])
  })
})
