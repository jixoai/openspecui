/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove running-backend navigation lists every lease without deriving identity from port (4.0c).
 * 2. Prove Task Manager exposes ownership-valid Stop/Close/favorite only (4.0d).
 *
 * Original request (2026-07-30): "所有正在运行中的backend都会显示在这里。"
 * Original request (2026-07-30): "任务管理器...可以杀掉Workspace，或者收藏、取消收藏"
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
    health: 'ready',
    managedGeneration: 1,
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
  it('a ready daemon-managed backend exposes exact-generation Stop + favorite', () => {
    const commands = resolveRunningBackendCommands(
      entry({
        ownership: 'daemon-managed',
        health: 'ready',
        managedGeneration: 7,
        projectPath: '/p',
      })
    )
    expect(commands).toContainEqual({ kind: 'stop-managed', generation: 7 })
    expect(commands.some((c) => c.kind === 'favorite')).toBe(true)
  })

  it('an external backend exposes external Stop when ready', () => {
    const commands = resolveRunningBackendCommands(
      entry({
        ownership: 'external',
        health: 'ready',
        managedGeneration: undefined,
        projectPath: '/p',
      })
    )
    expect(commands).toContainEqual({ kind: 'stop-external' })
  })

  it('a backend without current managed generation offers Close only', () => {
    const commands = resolveRunningBackendCommands(
      entry({
        ownership: 'daemon-managed',
        health: 'unknown',
        managedGeneration: undefined,
        projectPath: '/p',
      })
    )
    expect(commands[0]).toEqual({ kind: 'close-only' })
    expect(commands.some((c) => c.kind.startsWith('stop'))).toBe(false)
  })

  it('favorite requires a canonical directory identity; absent path offers no favorite', () => {
    const withPath = resolveRunningBackendCommands(entry({ projectPath: '/p' }))
    expect(withPath.some((c) => c.kind === 'favorite')).toBe(true)
    const withoutPath = resolveRunningBackendCommands(entry({ projectPath: null }))
    expect(withoutPath.some((c) => c.kind === 'favorite')).toBe(false)
  })
})
