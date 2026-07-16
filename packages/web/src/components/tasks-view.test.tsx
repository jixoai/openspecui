import type { TrackedTask, TrackedTaskProgress } from '@openspecui/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TasksView } from './tasks-view'

function trackedTaskProgress(tasks: TrackedTask[]): TrackedTaskProgress {
  const completed = tasks.filter((task) => task.completed).length
  return {
    tasks,
    total: tasks.length,
    completed,
    remaining: tasks.length - completed,
    phase:
      tasks.length === 0 ? 'no-tasks' : completed === tasks.length ? 'complete' : 'in-progress',
    source: {
      kind: 'top-level-fallback',
      artifactId: null,
      outputPath: 'tasks.md',
      filePaths: ['tasks.md'],
    },
  }
}

function renderTasks(tasks: TrackedTask[]) {
  return render(<TasksView trackedTaskProgress={trackedTaskProgress(tasks)} tocBaseIndex={0} />)
}

describe('TasksView', () => {
  it('updates text when task text changes', () => {
    const tasks: TrackedTask[] = [
      {
        id: 'task-1',
        text: 'Initial task text',
        completed: false,
        section: 'Setup',
        location: { filePath: 'tasks.md', taskIndex: 1 },
      },
    ]

    const { rerender } = renderTasks(tasks)

    expect(screen.getByText('Initial task text')).toBeTruthy()

    const updatedTasks: TrackedTask[] = [
      {
        ...tasks[0],
        text: 'Updated task text',
      },
    ]

    rerender(<TasksView trackedTaskProgress={trackedTaskProgress(updatedTasks)} tocBaseIndex={0} />)

    expect(screen.getByText('Updated task text')).toBeTruthy()
    expect(screen.queryByText('Initial task text')).toBeNull()
  })
})
