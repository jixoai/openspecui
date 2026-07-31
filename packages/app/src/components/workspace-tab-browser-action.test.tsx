/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Prove the Workspace browser icon exposes disabled, keyboard, and pending states.
 * 2. Prove activation dispatches only the opaque daemon Workspace id.
 *
 * Original request (2026-07-29): "每个 Workspace tab 提供 open in browser icon-button。"
 */
// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceTabBrowserAction } from './workspace-tab-browser-action'

describe('Workspace tab browser action', () => {
  it('keeps manual connections visible but disabled', () => {
    render(
      <WorkspaceTabBrowserAction
        label="manual"
        workspaceId={null}
        pending={false}
        onOpen={vi.fn()}
      />
    )
    const action = screen.getByRole('button', { name: 'Open manual in browser' })
    expect(action.tagName).toBe('BUTTON')
    expect(action.getAttribute('aria-disabled')).toBe('true')
    expect(action.getAttribute('tabindex')).toBe('-1')
  })

  it('dispatches only the opaque id from pointer and keyboard activation', () => {
    const onOpen = vi.fn()
    const { rerender } = render(
      <WorkspaceTabBrowserAction
        label="project-a"
        workspaceId="workspace-a"
        pending={false}
        onOpen={onOpen}
      />
    )
    const action = screen.getByRole('button', { name: 'Open project-a in browser' })
    fireEvent.click(action)
    fireEvent.keyDown(action, { key: 'Enter' })
    expect(onOpen).toHaveBeenNthCalledWith(1, 'workspace-a')
    expect(onOpen).toHaveBeenNthCalledWith(2, 'workspace-a')

    rerender(
      <WorkspaceTabBrowserAction
        label="project-a"
        workspaceId="workspace-a"
        pending
        onOpen={onOpen}
      />
    )
    expect(action.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(action)
    expect(onOpen).toHaveBeenCalledTimes(2)
  })
})
