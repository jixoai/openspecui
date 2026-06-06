import { describe, expect, it } from 'vitest'
import type { SchemaDetail } from './opsx-types.js'
import type { ChangeFile } from './schemas.js'
import { projectTasksFromMarkdownFiles } from './task-progress.js'

function file(path: string, content: string): ChangeFile {
  return { path, type: 'file', content }
}

const schemaDetail: SchemaDetail = {
  name: 'vision-driven',
  artifacts: [
    {
      id: 'plan',
      outputPath: 'plans/*.md',
      requires: [],
    },
    {
      id: 'todo',
      outputPath: 'todo.md',
      requires: [],
    },
  ],
  applyRequires: [],
  applyTracks: 'tasks.md',
}

describe('task progress projection', () => {
  it('parses checkbox tasks from every schema-matched markdown artifact', () => {
    const projection = projectTasksFromMarkdownFiles(
      [
        file('tasks.md', '# Tasks\n\n- [x] Root task\n  - [ ] Nested follow-up'),
        file('todo.md', '## Todo\n\n- [ ] Todo item'),
        file('plans/phase.md', '### Plan\n\n- [x] Plan item'),
        file('notes.md', '- [x] Untracked note checkbox'),
        file('notes.txt', '- [x] Non-markdown checkbox'),
      ],
      { schemaDetail, hasSchemaMetadata: true }
    )

    expect(projection.progress).toEqual({ total: 4, completed: 2 })
    expect(projection.tasks.map((task) => task.text)).toEqual([
      'Root task',
      'Nested follow-up',
      'Todo item',
      'Plan item',
    ])
  })

  it('falls back to all markdown files when schema metadata exists but schema detail is unavailable', () => {
    const projection = projectTasksFromMarkdownFiles(
      [
        file('plans/plan.md', '- [x] Plan checkbox'),
        file('review/self-review.md', '- [ ] Review checkbox'),
        file('notes.txt', '- [x] Text checkbox'),
      ],
      { hasSchemaMetadata: true }
    )

    expect(projection.progress).toEqual({ total: 2, completed: 1 })
  })

  it('keeps legacy entities scoped to root tasks.md', () => {
    const projection = projectTasksFromMarkdownFiles([
      file('proposal.md', '- [x] Proposal checkbox should not become a task'),
      file('tasks.md', '- [ ] Real task'),
      file('plans/plan.md', '- [x] Legacy plan checkbox should not become a task'),
    ])

    expect(projection.progress).toEqual({ total: 1, completed: 0 })
    expect(projection.tasks[0]?.text).toBe('Real task')
  })
})
