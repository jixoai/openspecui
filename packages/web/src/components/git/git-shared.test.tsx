import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DiffStat, GitFilesBadge } from './git-shared'

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

    expect(container).toBeEmptyDOMElement()
  })
})

describe('GitFilesBadge', () => {
  it('hides file counts when the count is zero', () => {
    const { container } = render(<GitFilesBadge files={0} />)

    expect(container).toBeEmptyDOMElement()
  })
})
