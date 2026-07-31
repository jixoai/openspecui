/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove Git path parsing preserves objective rename and OpenSpec change identities.
 * 2. Prove cooperative cancellation terminates the owned Git subprocess command.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Original request (2026-07-31): "Code Git Snapshot，它非常慢，有时候甚至要十几秒"
 */
import { describe, expect, it } from 'vitest'

import { defaultRunGit, extractGitPathVariants, parseRelatedChanges } from './git-shared.js'

describe('defaultRunGit', () => {
  it('rejects promptly when the owning Projection Work aborts', async () => {
    const controller = new AbortController()
    const command = defaultRunGit(
      process.cwd(),
      ['-c', 'alias.openspecui-wait=!sleep 5', 'openspecui-wait'],
      controller.signal
    )

    setTimeout(() => controller.abort(), 20)

    await expect(command).rejects.toMatchObject({ name: 'AbortError' })
  })
})

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
