/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Prove daemon snapshots bind credentials before applying credential-free launch targets.
 * 2. Prove backend locators resolve only to daemon-provided opaque Workspace ids.
 * 3. Prove admission decisions open/focus only on `admit`; an unchanged snapshot never reopens a closed Workspace (3.2/3.7).
 *
 * Original request (2026-07-29): "页面只投递 opaque Workspace id。"
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录。"
 */
import type { AppDaemonWorkspaceSnapshot } from '@openspecui/core/app-daemon-control'
import { describe, expect, it } from 'vitest'
import {
  createEmptyAdmissionState,
  dismissWorkspace,
  reduceDaemonSnapshot,
} from '../lib/daemon-workspace-admission'
import { clearLaunchCredential, readLaunchCredential } from '../lib/launch-credential'
import { applyDaemonWorkspaceSnapshot } from './app-daemon-workspace-owner'

function snapshot(
  workspaces: Array<{ id: string; apiBaseUrl: string; credential: string | null }>
): AppDaemonWorkspaceSnapshot {
  return {
    revision: 1,
    workspaces: workspaces.map((w) => ({
      id: w.id,
      backendUrl: w.apiBaseUrl,
      credential: w.credential,
      projectDir: `/projects/${w.id}`,
      ownership: 'external',
      registeredAt: 1,
      managedGeneration: null,
      shutdown: 'close-only',
      git: null,
    })),
  }
}

describe('App daemon Workspace snapshot application', () => {
  it('binds locator authority for every current workspace and retains the opaque id', () => {
    const apiBaseUrl = 'http://127.0.0.1:3100'
    clearLaunchCredential(apiBaseUrl)
    const applied: Array<{ apiBaseUrl: string; credentialAtApply: string | null }> = []
    const reduction = reduceDaemonSnapshot(createEmptyAdmissionState(), ['workspace-a'])

    const ids = applyDaemonWorkspaceSnapshot(
      snapshot([{ id: 'workspace-a', apiBaseUrl, credential: 'runtime-only' }]),
      reduction.decisions,
      (target) => {
        applied.push({ apiBaseUrl: target, credentialAtApply: readLaunchCredential(target) })
      }
    )

    // First admission opens the Workspace.
    expect(applied).toEqual([{ apiBaseUrl, credentialAtApply: 'runtime-only' }])
    expect(ids).toEqual(new Map([[apiBaseUrl, 'workspace-a']]))
    clearLaunchCredential(apiBaseUrl)
  })

  it('revokes a previously bound locator credential when its current snapshot is anonymous', () => {
    const apiBaseUrl = 'http://127.0.0.1:3101'
    clearLaunchCredential(apiBaseUrl)
    let reduction = reduceDaemonSnapshot(createEmptyAdmissionState(), ['workspace-a'])
    applyDaemonWorkspaceSnapshot(
      snapshot([{ id: 'workspace-a', apiBaseUrl, credential: 'runtime-only' }]),
      reduction.decisions,
      () => {}
    )
    reduction = reduceDaemonSnapshot(reduction.state, ['workspace-a'])
    const appliedCredentials: Array<string | null> = []
    applyDaemonWorkspaceSnapshot(
      snapshot([{ id: 'workspace-a', apiBaseUrl, credential: null }]),
      reduction.decisions,
      (target) => appliedCredentials.push(readLaunchCredential(target))
    )

    // Unchanged snapshot => no-change decision => no reopen, but credential still refreshed to null.
    expect(appliedCredentials).toEqual([])
    expect(readLaunchCredential(apiBaseUrl)).toBeNull()
  })
})

describe('App daemon admission-driven launch (3.2/3.7)', () => {
  it('opens a Workspace only on the first admission (admit), not on an unchanged repeat (no-change)', () => {
    const apiBaseUrl = 'http://127.0.0.1:3102'
    clearLaunchCredential(apiBaseUrl)
    let state = createEmptyAdmissionState()

    const first = reduceDaemonSnapshot(state, ['workspace-a'])
    state = first.state
    const openedFirst: string[] = []
    applyDaemonWorkspaceSnapshot(
      snapshot([{ id: 'workspace-a', apiBaseUrl, credential: null }]),
      first.decisions,
      (target) => openedFirst.push(target)
    )
    expect(openedFirst).toEqual([apiBaseUrl])

    // Unchanged repeat snapshot: no-change decision => NOT reopened.
    const repeat = reduceDaemonSnapshot(state, ['workspace-a'])
    const openedRepeat: string[] = []
    applyDaemonWorkspaceSnapshot(
      snapshot([{ id: 'workspace-a', apiBaseUrl, credential: null }]),
      repeat.decisions,
      (target) => openedRepeat.push(target)
    )
    expect(openedRepeat).toEqual([])
  })

  it('does NOT reopen a user-closed Workspace when the daemon snapshot is unchanged', () => {
    const apiBaseUrl = 'http://127.0.0.1:3103'
    clearLaunchCredential(apiBaseUrl)
    let state = reduceDaemonSnapshot(createEmptyAdmissionState(), ['workspace-b']).state
    // User closes the open Workspace -> dismissal recorded.
    state = dismissWorkspace(state, 'workspace-b')

    // Daemon still publishes workspace-b in an unchanged snapshot.
    const repeat = reduceDaemonSnapshot(state, ['workspace-b'])
    const opened: string[] = []
    applyDaemonWorkspaceSnapshot(
      snapshot([{ id: 'workspace-b', apiBaseUrl, credential: null }]),
      repeat.decisions,
      (target) => opened.push(target)
    )
    // already-dismissed => no reopen. This is the 3.2 green case.
    expect(opened).toEqual([])
    expect(repeat.decisions).toEqual([{ kind: 'already-dismissed', workspaceId: 'workspace-b' }])
  })
})
