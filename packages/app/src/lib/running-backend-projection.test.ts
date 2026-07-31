/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove registered backends retain path-first identity without deriving identity from port (4.0c).
 * 2. Prove Task Manager exposes only callable lifecycle commands plus independent favorite actions (4.0d).
 * 3. Prove an external close-only lease never fabricates Close, Remove, Delete, or Stop authority.
 *
 * Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
 * Original request (2026-07-30): "任务管理器...可以杀掉Workspace，或者收藏、取消收藏"
 * Owner correction (2026-07-31): Running requires Health API plus an established WebSocket; external close-only
 *   rows expose no fake lifecycle action.
 */
import { describe, expect, it } from 'vitest'
import {
  composeRunningBackendNavigation,
  resolveRunningBackendCommands,
  type RunningBackendEntry,
} from './running-backend-projection'
import { selectWorkspacePathLabel } from './workspace-path-label'

function entry(overrides: Partial<RunningBackendEntry> & { id: string }): RunningBackendEntry {
  return {
    projectPath: '/projects/a',
    ownership: 'daemon-managed',
    health: 'running',
    managedGeneration: 1,
    shutdown: 'managed',
    label: selectWorkspacePathLabel({
      projectPath: '/projects/a',
      git: { githubRemote: 'https://github.com/org/a.git', branch: 'main' },
    }),
    ...overrides,
  }
}

describe('running backend navigation (4.0c)', () => {
  it('lists every current backend lease and focuses by stable id, not port', () => {
    const leases = [
      entry({ id: 'ws-a', projectPath: '/projects/a' }),
      entry({ id: 'ws-b', projectPath: '/projects/b' }),
    ]
    const nav = composeRunningBackendNavigation(leases)
    expect(nav.map((e) => e.id)).toEqual(['ws-a', 'ws-b'])
    // Identity is path-first, not port-derived.
    expect(nav[0]?.label.githubSlug).toBe('org/a')
  })

  it('deduplicates by stable id while preserving observed order', () => {
    const nav = composeRunningBackendNavigation([
      entry({ id: 'ws-a' }),
      entry({ id: 'ws-b' }),
      entry({ id: 'ws-a' }),
    ])
    expect(nav.map((e) => e.id)).toEqual(['ws-a', 'ws-b'])
  })
})

describe('running backend Task Manager commands (4.0d)', () => {
  it('a running daemon-managed backend exposes exact-generation Stop + favorite', () => {
    const commands = resolveRunningBackendCommands(
      entry({
        ownership: 'daemon-managed',
        health: 'running',
        managedGeneration: 7,
        projectPath: '/p',
      })
    )
    expect(commands).toContainEqual({ kind: 'stop-managed', generation: 7 })
    expect(commands.some((c) => c.kind === 'favorite')).toBe(true)
  })

  it('an external backend exposes no lifecycle action without a callable App shutdown channel', () => {
    const commands = resolveRunningBackendCommands(
      entry({
        ownership: 'external',
        health: 'running',
        managedGeneration: undefined,
        shutdown: 'external-owner',
        projectPath: '/p',
      })
    )
    expect(commands.map((command) => command.kind)).toEqual(['favorite'])
  })

  it('an external close-only lease exposes no lifecycle action', () => {
    const commands = resolveRunningBackendCommands(
      entry({
        ownership: 'external',
        health: 'unknown',
        managedGeneration: undefined,
        shutdown: 'close-only',
        projectPath: '/p',
      })
    )
    expect(commands.map((command) => command.kind)).toEqual(['favorite'])
    expect(
      commands.some((command) => ['close-only', 'remove', 'delete'].includes(command.kind))
    ).toBe(false)
  })

  it('favorite requires a canonical directory identity; absent path offers no favorite', () => {
    const withPath = resolveRunningBackendCommands(entry({ projectPath: '/p' }))
    expect(withPath.some((c) => c.kind === 'favorite')).toBe(true)
    const withoutPath = resolveRunningBackendCommands(entry({ projectPath: null }))
    expect(withoutPath.some((c) => c.kind === 'favorite')).toBe(false)
  })
})
