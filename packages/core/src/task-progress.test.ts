import { describe, expect, it } from 'vitest'
import type { SchemaDetail } from './opsx-types.js'
import type { ChangeFile } from './schemas.js'
import {
  createApplyInstructionProgress,
  projectTaskProjectionsFromMarkdownFiles,
} from './task-progress.js'

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
      id: 'work',
      outputPath: 'work/**/*.md',
      requires: [],
    },
  ],
  applyRequires: [],
  applyTracks: 'work/**/*.md',
}

describe('task projections', () => {
  it('uses only the artifact selected by apply.tracks for tracked workflow truth', () => {
    const projection = projectTaskProjectionsFromMarkdownFiles(
      [
        file('tasks.md', '- [x] Top-level fallback must not be mixed in'),
        file('plans/phase.md', '- [x] Planning checkbox\n- [ ] Planning residue'),
        file('work/backend/tasks.md', '- [x] Backend\n- [ ] Backend follow-up'),
        file('work/frontend/tasks.md', '- [x] Frontend'),
        file('notes.md', '- [x] Untracked note checkbox'),
      ],
      { schemaDetail, hasSchemaMetadata: true }
    )

    expect(projection.trackedTaskProgress).toMatchObject({
      total: 3,
      completed: 2,
      remaining: 1,
      phase: 'in-progress',
      source: {
        kind: 'artifact',
        artifactId: 'work',
        outputPath: 'work/**/*.md',
        filePaths: ['work/backend/tasks.md', 'work/frontend/tasks.md'],
      },
    })
    expect(projection.trackedTaskProgress.tasks.map((task) => task.text)).toEqual([
      'Backend',
      'Backend follow-up',
      'Frontend',
    ])
  })

  it('falls back only to top-level tasks.md when tracked artifact resolution fails', () => {
    const projection = projectTaskProjectionsFromMarkdownFiles(
      [
        file('tasks.md', '- [x] Fallback\n- [ ] Remaining'),
        file('work/a.md', '- [x] Must not leak into fallback'),
      ],
      {
        schemaDetail: { ...schemaDetail, applyTracks: 'missing/*.md' },
        hasSchemaMetadata: true,
      }
    )

    expect(projection.trackedTaskProgress).toMatchObject({
      total: 2,
      completed: 1,
      phase: 'in-progress',
      source: { kind: 'top-level-fallback', filePaths: ['tasks.md'] },
    })
  })

  it('falls back to top-level tasks.md when the selected glob matches no source', () => {
    const projection = projectTaskProjectionsFromMarkdownFiles(
      [file('tasks.md', '- [x] Fallback')],
      { schemaDetail, hasSchemaMetadata: true }
    )

    expect(projection.trackedTaskProgress.source.kind).toBe('top-level-fallback')
    expect(projection.trackedTaskProgress.total).toBe(1)
  })

  it('uses the tasks artifact when a schema omits apply.tracks', () => {
    const projection = projectTaskProjectionsFromMarkdownFiles(
      [file('nested/a.md', '- [x] A'), file('tasks.md', '- [ ] Top-level')],
      {
        schemaDetail: {
          ...schemaDetail,
          applyTracks: undefined,
          artifacts: [{ id: 'tasks', outputPath: 'nested/*.md', requires: [] }],
        },
        hasSchemaMetadata: true,
      }
    )

    expect(projection.trackedTaskProgress).toMatchObject({
      total: 1,
      completed: 1,
      phase: 'complete',
      source: { kind: 'artifact', artifactId: 'tasks', outputPath: 'nested/*.md' },
    })
  })

  it('maps a missing tracked source to no-tasks, never complete', () => {
    const projection = projectTaskProjectionsFromMarkdownFiles([], {
      schemaDetail,
      hasSchemaMetadata: true,
    })

    expect(projection.trackedTaskProgress).toMatchObject({
      total: 0,
      completed: 0,
      remaining: 0,
      phase: 'no-tasks',
      source: { kind: 'none' },
    })
  })

  it('groups every schema Markdown document once as secondary analytics', () => {
    const overlappingSchema: SchemaDetail = {
      ...schemaDetail,
      artifacts: [
        { id: 'all-work', outputPath: 'work/**/*.md', requires: [] },
        { id: 'backend', outputPath: 'work/backend/*.md', requires: [] },
        { id: 'plan', outputPath: 'plans/*.md', requires: [] },
      ],
      applyTracks: 'work/**/*.md',
    }
    const projection = projectTaskProjectionsFromMarkdownFiles(
      [
        file('work/backend/tasks.md', '- [x] A\n- [ ] B'),
        file('plans/plan.md', '- [x] Planned'),
        file('notes.md', '- [x] Not a schema document'),
      ],
      { schemaDetail: overlappingSchema, hasSchemaMetadata: true }
    )

    expect(projection.documentChecklistSummary).toMatchObject({
      total: 3,
      completed: 2,
      remaining: 1,
    })
    expect(projection.documentChecklistSummary.groups).toEqual([
      expect.objectContaining({
        artifactIds: ['plan'],
        filePath: 'plans/plan.md',
        total: 1,
        completed: 1,
      }),
      expect.objectContaining({
        artifactIds: ['all-work', 'backend'],
        filePath: 'work/backend/tasks.md',
        total: 2,
        completed: 1,
      }),
    ])
    expect(projection.documentChecklistSummary).not.toHaveProperty('phase')
  })

  it('retains all Markdown documents as secondary analytics when schema metadata exists but detail is unavailable', () => {
    const projection = projectTaskProjectionsFromMarkdownFiles(
      [
        file('plans/plan.md', '- [x] Plan checkbox'),
        file('review/self-review.md', '- [ ] Review checkbox'),
        file('notes.txt', '- [x] Text checkbox'),
      ],
      { hasSchemaMetadata: true }
    )

    expect(projection.trackedTaskProgress.phase).toBe('no-tasks')
    expect(projection.documentChecklistSummary).toMatchObject({ total: 2, completed: 1 })
  })

  it('attributes Apply divergence without replacing either source', () => {
    const tracked = projectTaskProjectionsFromMarkdownFiles(
      [file('work/a.md', '- [x] A\n- [ ] B'), file('work/b.md', '- [ ] C')],
      { schemaDetail, hasSchemaMetadata: true }
    ).trackedTaskProgress
    const applyInstructionProgress = createApplyInstructionProgress(
      { total: 0, complete: 0, remaining: 0, state: 'all_done' },
      tracked
    )

    expect(applyInstructionProgress).toMatchObject({
      source: 'openspec-instructions-apply',
      total: 0,
      complete: 0,
      remaining: 0,
      state: 'all_done',
      divergence: {
        kind: 'tracked-task-mismatch',
        apply: { total: 0, complete: 0, remaining: 0 },
        tracked: { total: 3, completed: 1, remaining: 2, phase: 'in-progress' },
      },
    })
  })
})
