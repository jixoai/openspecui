/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Prove memoized tasks refresh authored text and physical identity.
 * 2. Prove a running task mutation locks its control.
 *
 * Original request (2026-07-15): "Every network-triggering control binds loading/disabled state."
 */
import type { TrackedTask, TrackedTaskProgress } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TasksView } from './tasks-view'

afterEach(cleanup)

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

  it('uses the latest physical location when a memoized task moves', () => {
    const onToggle = vi.fn()
    const task: TrackedTask = {
      id: 'task-1',
      text: 'Backend task',
      completed: false,
      location: { filePath: 'work/old.md', taskIndex: 1 },
    }
    const { rerender } = render(
      <TasksView trackedTaskProgress={trackedTaskProgress([task])} onToggleTask={onToggle} />
    )

    rerender(
      <TasksView
        trackedTaskProgress={trackedTaskProgress([
          { ...task, location: { filePath: 'work/backend/tasks.md', taskIndex: 2 } },
        ])}
        onToggleTask={onToggle}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Backend task/ }))

    expect(onToggle).toHaveBeenCalledWith({ filePath: 'work/backend/tasks.md', taskIndex: 2 }, true)
  })

  it('locks the task control while its mutation is running', () => {
    render(
      <TasksView
        trackedTaskProgress={trackedTaskProgress([
          {
            id: 'task-1',
            text: 'Backend task',
            completed: false,
            location: { filePath: 'tasks.md', taskIndex: 1 },
          },
        ])}
        togglingLocation={{ filePath: 'tasks.md', taskIndex: 1 }}
        onToggleTask={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Backend task/ })).toBeDisabled()
  })
})
