/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove Workspaces secondary navigation directly lists favorite directories without a section accordion.
 * 2. Prove selecting one starts/focuses the canonical directory rather than a backend locator.
 * 3. Prove running state is a right-side signal and never a selected-row highlight.
 * 4. Prove the empty state contributes no redundant secondary navigation chrome.
 *
 * Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
 * Owner correction (2026-07-31): "runnings 这个列表的子元素，直接改成 Favorites，没有 Favorites 手风琴折叠，直接二级罗列"
 * Owner correction (2026-07-31): Workspace secondary rows never highlight; a right-side signal reports Running.
 */
// @vitest-environment jsdom
import type { WorkspaceDirectoryEntry } from '@openspecui/core/workspace-directory-catalog'
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspacesSecondaryNav } from './workspaces-secondary-nav'

async function renderAt(element: ReactElement): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(element)
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return { container, root }
}

function favorite(canonicalPath: string): WorkspaceDirectoryEntry {
  return { canonicalPath, favorite: true, lastOpenedAt: 1 }
}

describe('WorkspacesSecondaryNav favorites', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('directly lists favorite directories without Running/Favorites accordion chrome', async () => {
    await renderAt(
      <WorkspacesSecondaryNav
        favorites={[favorite('/projects/a'), favorite('/projects/second-project')]}
        onSelect={() => {}}
      />
    )
    expect(screen.getByText('a')).toBeTruthy()
    expect(screen.getByText('second-project')).toBeTruthy()
    expect(screen.queryByText(/Running/)).toBeNull()
    expect(screen.queryByText(/Favorites/)).toBeNull()
    expect(screen.queryByRole('button', { name: /expand|collapse/i })).toBeNull()
  })

  it('selects the canonical favorite path', async () => {
    const onSelect = vi.fn()
    await renderAt(
      <WorkspacesSecondaryNav favorites={[favorite('/projects/a')]} onSelect={onSelect} />
    )
    fireEvent.click(screen.getByText('a'))
    expect(onSelect).toHaveBeenCalledWith('/projects/a')
  })

  it('uses only right-side signals for running state without highlighting a row', async () => {
    await renderAt(
      <WorkspacesSecondaryNav
        favorites={[favorite('/projects/a'), favorite('/projects/second-project')]}
        runningPaths={['/projects/second-project']}
        onSelect={() => {}}
      />
    )
    const stoppedButton = screen.getByText('a').closest('button')
    const runningButton = screen.getByText('second-project').closest('button')
    expect(stoppedButton?.className).not.toContain('bg-primary')
    expect(runningButton?.className).not.toContain('bg-primary')
    expect(stoppedButton?.querySelector('[aria-label="Workspace stopped"]')).toBeTruthy()
    expect(runningButton?.querySelector('[aria-label="Workspace running"]')).toBeTruthy()
  })

  it('renders no secondary navigation when there are no favorites', async () => {
    const { container } = await renderAt(
      <WorkspacesSecondaryNav favorites={[]} onSelect={() => {}} />
    )
    expect(container.textContent).toBe('')
  })
})
