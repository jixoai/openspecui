/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Prove daemon snapshots bind credentials before applying credential-free launch targets.
 * 2. Prove backend locators resolve only to daemon-provided opaque Workspace ids.
 *
 * Original request (2026-07-29): "页面只投递 opaque Workspace id。"
 */
import { describe, expect, it } from 'vitest'
import { clearLaunchCredential, readLaunchCredential } from '../lib/launch-credential'
import { applyDaemonWorkspaceSnapshot } from './app-daemon-workspace-owner'

describe('App daemon Workspace snapshot application', () => {
  it('binds locator authority before applying the launch and retains the opaque id', () => {
    const apiBaseUrl = 'http://127.0.0.1:3100'
    clearLaunchCredential(apiBaseUrl)
    const applied: Array<{ apiBaseUrl: string; credentialAtApply: string | null }> = []

    const ids = applyDaemonWorkspaceSnapshot(
      {
        revision: 1,
        workspaces: [{ id: 'workspace-a', backendUrl: apiBaseUrl, credential: 'runtime-only' }],
      },
      (target) => {
        applied.push({
          apiBaseUrl: target,
          credentialAtApply: readLaunchCredential(target),
        })
      }
    )

    expect(applied).toEqual([{ apiBaseUrl, credentialAtApply: 'runtime-only' }])
    expect(ids).toEqual(new Map([[apiBaseUrl, 'workspace-a']]))
    clearLaunchCredential(apiBaseUrl)
  })
})
