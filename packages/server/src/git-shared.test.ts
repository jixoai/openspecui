import { describe, expect, it } from 'vitest'

import { extractGitPathVariants, parseRelatedChanges } from './git-shared.js'

describe('extractGitPathVariants', () => {
  it('expands brace rename paths without leaking raw rename syntax', () => {
    expect(
      extractGitPathVariants(
        'openspec/changes/{compact-chat-density-and-layout-rubric => archive/2026-03-25-compact-chat-density-and-layout-rubric}/proposal.md'
      )
    ).toEqual([
      'openspec/changes/compact-chat-density-and-layout-rubric/proposal.md',
      'openspec/changes/archive/2026-03-25-compact-chat-density-and-layout-rubric/proposal.md',
    ])
  })
})

describe('parseRelatedChanges', () => {
  it('maps renamed archive paths back to change ids', () => {
    const related = parseRelatedChanges(
      extractGitPathVariants(
        'openspec/changes/{timeline-pagination-and-virtualization => archive/2026-03-25-timeline-pagination-and-virtualization}/tasks.md'
      )
    )

    expect(related).toEqual(['timeline-pagination-and-virtualization'])
  })

  it('ignores unresolved rename syntax fragments', () => {
    expect(
      parseRelatedChanges([
        'openspec/changes/{unified-top-header-and-adaptive-composer => archive/2026-03-25-unified-top-header-and-adaptive-composer}/proposal.md',
      ])
    ).toEqual([])
  })
})
