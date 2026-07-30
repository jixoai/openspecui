/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Workspaces secondary nav projects every running backend with path-first labels (8.1a).
 * 2. Prove selecting one focuses/opens the exact Workspace; no port identity.
 *
 * Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
 */
// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunningBackendEntry } from '../lib/running-backend-projection'
import { selectWorkspacePathLabel } from '../lib/workspace-path-label'
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

function entry(overrides: Partial<RunningBackendEntry> & { id: string }): RunningBackendEntry {
  return {
    projectPath: '/projects/a',
    ownership: 'daemon-managed',
    health: 'ready',
    managedGeneration: 1,
    shutdown: 'managed',
    label: selectWorkspacePathLabel({
      projectPath: '/projects/a',
      git: { githubRemote: 'https://github.com/org/a.git', branch: 'main' },
    }),
    ...overrides,
  }
}

describe('WorkspacesSecondaryNav (8.1a)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('projects every running backend with path-first labels (no port)', async () => {
    await renderAt(
      <WorkspacesSecondaryNav
        entries={[
          entry({
            id: 'ws-a',
            label: selectWorkspacePathLabel({
              projectPath: '/projects/a',
              git: { githubRemote: 'https://github.com/org/a.git', branch: 'main' },
            }),
          }),
          entry({
            id: 'ws-b',
            label: selectWorkspacePathLabel({ projectPath: '/projects/second-backend' }),
          }),
        ]}
        onSelect={() => {}}
      />
    )
    // Path-first GitHub slug + basename fallback render; no port.
    expect(screen.getByText('org/a')).toBeTruthy()
    expect(screen.getByText('second-backend')).toBeTruthy()
    expect(screen.getByText('Running (2)')).toBeTruthy()
  })

  it('selects the exact Workspace on click', async () => {
    const onSelect = vi.fn()
    await renderAt(<WorkspacesSecondaryNav entries={[entry({ id: 'ws-a' })]} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('org/a'))
    expect(onSelect).toHaveBeenCalledWith('ws-a')
  })

  it('marks the active Workspace', async () => {
    await renderAt(
      <WorkspacesSecondaryNav
        entries={[
          entry({ id: 'ws-a' }),
          entry({
            id: 'ws-b',
            label: selectWorkspacePathLabel({ projectPath: '/projects/second-backend' }),
          }),
        ]}
        activeId="ws-b"
        onSelect={() => {}}
      />
    )
    const activeButton = screen.getByText('second-backend').closest('button')
    expect(activeButton?.className).toContain('bg-primary')
  })

  it('renders an external backend marker', async () => {
    await renderAt(
      <WorkspacesSecondaryNav
        entries={[entry({ id: 'ws-ext', ownership: 'external' })]}
        onSelect={() => {}}
      />
    )
    expect(screen.getByLabelText('external backend')).toBeTruthy()
  })

  it('collapses and expands', async () => {
    await renderAt(<WorkspacesSecondaryNav entries={[entry({ id: 'ws-a' })]} onSelect={() => {}} />)
    expect(screen.getByText('org/a')).toBeTruthy()
    fireEvent.click(screen.getByText('Running (1)'))
    expect(screen.queryByText('org/a')).toBeNull()
  })

  it('renders nothing listing when no backends are running', async () => {
    await renderAt(<WorkspacesSecondaryNav entries={[]} onSelect={() => {}} />)
    expect(screen.getByText('Running (0)')).toBeTruthy()
    expect(screen.queryByText('org/a')).toBeNull()
  })
})
