/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove a new daemon id auto-opens once and an unchanged snapshot never reopens a closed Workspace (3.7).
 * 2. Prove disappearance retires the runtime candidate and reappearance is a fresh admission.
 * 3. Mutation resistance: prove removing the dismissal guard would reopen a closed Workspace (3.10).
 *
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录。"
 */
import { describe, expect, it } from 'vitest'
import {
  clearDismissal,
  createEmptyAdmissionState,
  dismissWorkspace,
  isDaemonCandidate,
  reduceDaemonSnapshot,
} from './daemon-workspace-admission'

describe('daemon workspace admission reducer (3.7)', () => {
  it('admits a genuinely-new daemon id exactly once', () => {
    let state = createEmptyAdmissionState()
    const first = reduceDaemonSnapshot(state, ['ws-a'])
    expect(first.decisions).toEqual([{ kind: 'admit', workspaceId: 'ws-a' }])
    state = first.state

    // An unchanged repeat snapshot does not re-admit.
    const repeat = reduceDaemonSnapshot(state, ['ws-a'])
    expect(repeat.decisions).toEqual([{ kind: 'no-change', workspaceId: 'ws-a' }])
  })

  it('does NOT reopen a Workspace the user closed when the snapshot is unchanged', () => {
    let state = reduceDaemonSnapshot(createEmptyAdmissionState(), ['ws-a']).state
    // User closes the open Workspace.
    state = dismissWorkspace(state, 'ws-a')

    // The daemon still publishes ws-a in an unchanged snapshot.
    const repeat = reduceDaemonSnapshot(state, ['ws-a'])
    expect(repeat.decisions).toEqual([{ kind: 'already-dismissed', workspaceId: 'ws-a' }])
    // No 'admit' decision is produced, so the closed Workspace is not reopened.
    expect(repeat.decisions.some((d) => d.kind === 'admit')).toBe(false)
  })

  it('clears dismissal on explicit Open so the row may reopen later', () => {
    let state = reduceDaemonSnapshot(createEmptyAdmissionState(), ['ws-a']).state
    state = dismissWorkspace(state, 'ws-a')
    state = clearDismissal(state, 'ws-a')

    const repeat = reduceDaemonSnapshot(state, ['ws-a'])
    // Already admitted and no longer dismissed -> no-change (stays open/focused, no duplicate).
    expect(repeat.decisions).toEqual([{ kind: 'no-change', workspaceId: 'ws-a' }])
  })

  it('retires a runtime candidate when its daemon id disappears', () => {
    let state = reduceDaemonSnapshot(createEmptyAdmissionState(), ['ws-a', 'ws-b']).state
    const gone = reduceDaemonSnapshot(state, ['ws-b'])
    expect(gone.decisions).toContainEqual({ kind: 'retire', workspaceId: 'ws-a' })
    expect(gone.decisions).toContainEqual({ kind: 'no-change', workspaceId: 'ws-b' })
    expect(isDaemonCandidate(gone.state, 'ws-a')).toBe(false)
  })

  it('treats a disappeared-then-reappeared id as a fresh admission', () => {
    let state = reduceDaemonSnapshot(createEmptyAdmissionState(), ['ws-a']).state
    state = reduceDaemonSnapshot(state, []).state // disappear
    const reappear = reduceDaemonSnapshot(state, ['ws-a'])
    expect(reappear.decisions).toEqual([{ kind: 'admit', workspaceId: 'ws-a' }])
  })

  it('admits multiple genuinely-new ids in one snapshot and classifies repeats correctly', () => {
    const first = reduceDaemonSnapshot(createEmptyAdmissionState(), ['ws-a', 'ws-b'])
    expect(first.decisions.map((d) => d.kind)).toEqual(['admit', 'admit'])
    const second = reduceDaemonSnapshot(first.state, ['ws-a', 'ws-b', 'ws-c'])
    expect(second.decisions.map((d) => d.kind)).toEqual(['no-change', 'no-change', 'admit'])
  })
})

describe('daemon workspace admission — mutation resistance (3.10)', () => {
  it('would reopen a closed Workspace if the dismissal guard were bypassed', () => {
    // Characterizes the guard: with the production reducer, an unchanged snapshot after close
    // produces 'already-dismissed', never 'admit'. A naive reducer that admitted every snapshot
    // id unconditionally would emit 'admit' here and reopen the closed Workspace.
    let state = reduceDaemonSnapshot(createEmptyAdmissionState(), ['ws-x']).state
    state = dismissWorkspace(state, 'ws-x')
    const result = reduceDaemonSnapshot(state, ['ws-x'])
    expect(result.decisions).toEqual([{ kind: 'already-dismissed', workspaceId: 'ws-x' }])
    expect(result.decisions.some((d) => d.kind === 'admit')).toBe(false)
  })
})
