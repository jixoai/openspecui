/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Prove Git entry handoffs carry mandatory origin binding provenance.
 * 2. Reject blank binding tokens and malformed commit identities at the handoff boundary.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement: Checkpoint 6.11 Git handoffs cannot omit live binding provenance.
 */
import type { DashboardGitEntry } from '@openspecui/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DiffStat, getGitEntrySharedHandoff, GitFilesBadge } from './git-shared'

type Expect<Value extends true> = Value
type GitHandoffTokenIsRequired = Expect<
  undefined extends Parameters<typeof getGitEntrySharedHandoff>[1] ? false : true
>
const checkedHandoffContract: GitHandoffTokenIsRequired = true

function commitEntry(hash = 'abc12345'): DashboardGitEntry {
  return {
    type: 'commit',
    hash,
    title: 'Commit A',
    committedAt: 1,
    relatedChanges: [],
    diff: { files: 1, insertions: 1, deletions: 0 },
  }
}

describe('getGitEntrySharedHandoff', () => {
  it('keeps origin binding provenance mandatory in the checked fixture', () => {
    expect(checkedHandoffContract).toBe(true)
  })

  it('requires a non-empty origin binding token', () => {
    expect(() => getGitEntrySharedHandoff(commitEntry(), '')).toThrow(
      /Git handoff requires a non-empty binding token/
    )
    expect(() => getGitEntrySharedHandoff(commitEntry(), '   ')).toThrow(
      /Git handoff requires a non-empty binding token/
    )
  })

  it('keeps the canonical commit entity in the typed handoff', () => {
    expect(getGitEntrySharedHandoff(commitEntry('def67890'), 'planning-binding-a')).toMatchObject({
      family: 'git',
      entityId: 'def67890',
      bindingToken: 'planning-binding-a',
    })
  })

  it('rejects a malformed empty commit identity', () => {
    expect(() => getGitEntrySharedHandoff(commitEntry(''), 'planning-binding-a')).toThrow(
      /Git entity id must be non-empty/
    )
  })
})

describe('DiffStat', () => {
  it('shows loading for git file diffs that have not been computed yet', () => {
    render(<DiffStat diff={{ state: 'loading', files: 1 }} />)

    expect(screen.getByText('loading')).toBeTruthy()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('renders numeric insertions and deletions for ready diffs', () => {
    render(<DiffStat diff={{ state: 'ready', files: 1, insertions: 3, deletions: 1 }} />)

    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('hides ready diffs when both insertions and deletions are zero', () => {
    const { container } = render(
      <DiffStat diff={{ state: 'ready', files: 1, insertions: 0, deletions: 0 }} />
    )

    expect(container.firstChild).toBeNull()
  })
})

describe('GitFilesBadge', () => {
  it('hides file counts when the count is zero', () => {
    const { container } = render(<GitFilesBadge files={0} />)

    expect(container.firstChild).toBeNull()
  })

  it('uses the shared badge primitive for visible file counts', () => {
    render(<GitFilesBadge files={3} />)

    const badge = screen.getByText('3f')
    expect(badge.getAttribute('data-ui-badge')).toBe('true')
    expect(badge.className).toContain('font-mono')
  })
})
