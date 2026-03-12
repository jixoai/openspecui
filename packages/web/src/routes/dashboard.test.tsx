import type { DashboardGitWorktree } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorktreeRow } from './dashboard'

describe('WorktreeRow', () => {
  const writeText = vi.fn<(value: string) => Promise<void>>()

  const baseWorktree: DashboardGitWorktree = {
    path: '/tmp/openspecui-feature-a',
    relativePath: '../tmp/openspecui-feature-a',
    branchName: 'feature-a',
    detached: false,
    isCurrent: false,
    ahead: 2,
    behind: 1,
    diff: { files: 3, insertions: 8, deletions: 2 },
    entries: [],
  }

  beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('copies on click and toggles path mode via button or double click', async () => {
    render(<WorktreeRow worktree={baseWorktree} emphasize={false} />)

    const copyButton = screen.getByRole('button', { name: 'Copy absolute path for feature-a' })
    expect(screen.getByText('/tmp/openspecui-feature-a')).toBeTruthy()

    fireEvent.click(copyButton)
    expect(writeText).toHaveBeenCalledWith('/tmp/openspecui-feature-a')

    fireEvent.doubleClick(copyButton)
    expect(screen.getByText('../tmp/openspecui-feature-a')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show absolute path' }))
    expect(screen.getByText('/tmp/openspecui-feature-a')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show relative path' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy relative path for feature-a' }))
    expect(writeText).toHaveBeenLastCalledWith('../tmp/openspecui-feature-a')
  })

  it('exposes direct removal for detached non-current worktrees', () => {
    const onRemove = vi.fn()

    render(
      <WorktreeRow
        worktree={{
          ...baseWorktree,
          branchName: '(detached)',
          detached: true,
        }}
        emphasize={false}
        onRemoveDetachedWorktree={onRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove detached worktree' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove.mock.calls[0]?.[0]).toMatchObject({
      path: '/tmp/openspecui-feature-a',
      detached: true,
    })
  })
})
