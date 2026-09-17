/**
 * Orthogonal intents (updated 2026-09-17 Asia/Shanghai):
 * 1. Prove tracked workflow truth and checklist analytics select the exact tracked artifact.
 * 2. Prove task-line reading parity with the admitted OpenSpec CLI 1.13 semantics.
 * 3. Prove checkbox toggles write canonical markers over the widened forms.
 *
 * Original request (2026-07-15): "统计信息仍然有一定的间接价值。"
 * Original request (2026-09-17): "Openspec 1.13.1 释放了…" — task-line reading parity with CLI 1.13.1 (update-openspec-cli-1131 Slice 3).
 */
import { describe, expect, it } from 'vitest'
import type { SchemaDetail } from './opsx-types.js'
import type { ChangeFile } from './schemas.js'
import {
  createApplyInstructionProgress,
  parseMarkdownTasks,
  projectTaskProjectionsFromMarkdownFiles,
  toggleMarkdownTask,
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
    expect(projection.trackedTaskProgress.tasks.map((task) => task.location)).toEqual([
      { filePath: 'work/backend/tasks.md', taskIndex: 1 },
      { filePath: 'work/backend/tasks.md', taskIndex: 2 },
      { filePath: 'work/frontend/tasks.md', taskIndex: 1 },
    ])
  })

  it('toggles the exact checkbox index while preserving Markdown structure', () => {
    const content = '# Work\n  * [ ] First\n- [ ] Second\n'

    expect(toggleMarkdownTask(content, 2, true)).toBe('# Work\n  * [ ] First\n- [x] Second\n')
    expect(toggleMarkdownTask(content, 3, true)).toBeNull()
    expect(toggleMarkdownTask(content, 0, true)).toBeNull()
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

describe('task-line reading parity with the admitted CLI (1.13.1)', () => {
  it('counts every widened CommonMark marker line as one task', () => {
    const widened: Array<[line: string, done: boolean, text: string]> = [
      ['+ [ ] a', false, 'a'],
      ['1. [ ] a', false, 'a'],
      ['1) [x] a', true, 'a'],
      ['  - [~] a', false, 'a'],
      ['* [x]done', true, 'done'],
      ['- [ x] a', true, 'a'],
      ['- [] a', false, 'a'],
      ['- [  ] a', false, 'a'],
      ['- [1] a', false, 'a'],
      ['- [ ](...)', false, '(...)'],
      ['- [ ][...]', false, '[...]'],
      ['- [x]', true, ''],
    ]

    for (const [line, done, text] of widened) {
      const parsed = parseMarkdownTasks(line)
      expect(parsed, `expected exactly one task: ${JSON.stringify(line)}`).toHaveLength(1)
      expect(parsed[0], JSON.stringify(line)).toMatchObject({ completed: done, text })
    }
  })

  it('keeps multi-token markers and Markdown link bullets out of the counts', () => {
    const excluded = ['- [WIP] note', '- [doc](./d.md)', '- [1](./one)', '- [x](./link.md)']

    for (const line of excluded) {
      expect(parseMarkdownTasks(line), `expected no task: ${JSON.stringify(line)}`).toHaveLength(0)
    }
  })

  it('tolerates CRLF line endings while parsing', () => {
    const parsed = parseMarkdownTasks('+ [x] done\r\n1) [ ] a\r')

    expect(parsed.map((task) => task.completed)).toEqual([true, false])
    expect(parsed.map((task) => task.text)).toEqual(['done', 'a'])
  })

  it('toggles widened marker forms with canonical checkbox write-back', () => {
    expect(toggleMarkdownTask('+ [ ] a', 1, true)).toBe('+ [x] a')
    expect(toggleMarkdownTask('+ [x] a', 1, false)).toBe('+ [ ] a')
    expect(toggleMarkdownTask('1. [~] a', 1, true)).toBe('1. [x] a')
    expect(toggleMarkdownTask('  1) [X] done', 1, false)).toBe('  1) [ ] done')
    expect(toggleMarkdownTask('* [x]done', 1, false)).toBe('* [ ]done')
    expect(toggleMarkdownTask('+ [ ] a\r', 1, true)).toBe('+ [x] a\r')
  })

  it('counts task lines for toggling with the same parity as reading', () => {
    const content = '## Work\n- [doc](./d.md)\n+ [ ] alpha\n1. [~] beta\n  - [x] gamma\n'

    expect(toggleMarkdownTask(content, 2, true)).toBe(
      '## Work\n- [doc](./d.md)\n+ [ ] alpha\n1. [x] beta\n  - [x] gamma\n'
    )
    expect(toggleMarkdownTask(content, 4, false)).toBeNull()
  })

  it('does not flag tracked-task divergence when CLI apply and local tracked read the same widened-syntax document', () => {
    const tracked = projectTaskProjectionsFromMarkdownFiles(
      [file('work/widened.md', '+ [x] Alpha\n+ [ ] Beta\n1. [~] Gamma\n1) [ ] Delta')],
      { schemaDetail, hasSchemaMetadata: true }
    ).trackedTaskProgress

    expect(tracked).toMatchObject({ total: 4, completed: 1, remaining: 3, phase: 'in-progress' })

    const applyInstructionProgress = createApplyInstructionProgress(
      { total: 4, complete: 1, remaining: 3, state: 'ready' },
      tracked
    )

    expect(applyInstructionProgress.divergence).toBeNull()
  })
})
