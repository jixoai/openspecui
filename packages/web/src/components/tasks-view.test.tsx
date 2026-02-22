import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TasksView, type Task } from './tasks-view'

function renderTasks(tasks: Task[]) {
  const completed = tasks.filter((task) => task.completed).length
  return render(
    <TasksView tasks={tasks} progress={{ total: tasks.length, completed }} tocBaseIndex={0} />
  )
}

describe('TasksView', () => {
  it('updates text when task text changes', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        text: 'Initial task text',
        completed: false,
        section: 'Setup',
      },
    ]

    const { rerender } = renderTasks(tasks)

    expect(screen.getByText('Initial task text')).toBeTruthy()

    const updatedTasks: Task[] = [
      {
        ...tasks[0],
        text: 'Updated task text',
      },
    ]

    rerender(
      <TasksView
        tasks={updatedTasks}
        progress={{ total: updatedTasks.length, completed: 0 }}
        tocBaseIndex={0}
      />
    )

    expect(screen.getByText('Updated task text')).toBeTruthy()
    expect(screen.queryByText('Initial task text')).toBeNull()
  })
})
