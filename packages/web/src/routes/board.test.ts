import { describe, expect, it } from 'vitest'
import { archiveTimestamp, classifyBoardColumn } from './board'

describe('classifyBoardColumn', () => {
  it('places a change with no tasks defined (0/0) in TODO, never QA', () => {
    expect(classifyBoardColumn({ total: 0, completed: 0 })).toBe('todo')
  })

  it('places a change with tasks but none complete (0/N) in TODO', () => {
    expect(classifyBoardColumn({ total: 5, completed: 0 })).toBe('todo')
  })

  it('places a change with some tasks complete in IN PROGRESS', () => {
    expect(classifyBoardColumn({ total: 5, completed: 1 })).toBe('in-progress')
    expect(classifyBoardColumn({ total: 5, completed: 4 })).toBe('in-progress')
  })

  it('places a change with all tasks complete in QA', () => {
    expect(classifyBoardColumn({ total: 5, completed: 5 })).toBe('qa')
    expect(classifyBoardColumn({ total: 1, completed: 1 })).toBe('qa')
  })
})

describe('archiveTimestamp', () => {
  const meta = (id: string, updatedAt: number) => ({
    id,
    name: id,
    progress: { total: 0, completed: 0 },
    createdAt: 0,
    updatedAt,
  })

  it('derives the timestamp from the YYYY-MM-DD- id prefix', () => {
    expect(archiveTimestamp(meta('2026-06-30-target-openspec-cli-15-line', 0))).toBe(
      Date.UTC(2026, 5, 30)
    )
  })

  it('falls back to updatedAt when the id has no date prefix', () => {
    const updatedAt = 1_700_000_000_000
    expect(archiveTimestamp(meta('some-undated-change', updatedAt))).toBe(updatedAt)
  })
})
