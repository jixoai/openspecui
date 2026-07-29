/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Prove which acknowledged hosted launches retire their transient source Document.
 * 2. Preserve locally applied and fallback-applied App surfaces.
 * 3. Prove daemon snapshots bind runtime credentials before applying credential-free launches.
 *
 * Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口。"
 */
import { describe, expect, it, vi } from 'vitest'
import { clearLaunchCredential, readLaunchCredential } from '../lib/launch-credential'
import type { HostedLaunchDispatchResult } from '../lib/launch-relay'
import {
  applyDaemonWorkspaceSnapshot,
  retireHostedLaunchSourceBestEffort,
} from './app-launch-owner'

describe('App launch source retirement', () => {
  it.each(['forwarded', 'forwarded-to-pwa'] satisfies HostedLaunchDispatchResult[])(
    'retires the transient source after %s acknowledgement',
    (result) => {
      const closeSource = vi.fn()
      retireHostedLaunchSourceBestEffort(result, closeSource)
      expect(closeSource).toHaveBeenCalledOnce()
    }
  )

  it.each(['applied', 'fallback-applied'] satisfies HostedLaunchDispatchResult[])(
    'keeps the source mounted when the request is %s',
    (result) => {
      const closeSource = vi.fn()
      retireHostedLaunchSourceBestEffort(result, closeSource)
      expect(closeSource).not.toHaveBeenCalled()
    }
  )
})

describe('App daemon Workspace launch application', () => {
  it('binds locator authority before applying a credential-free launch target', () => {
    const apiBaseUrl = 'http://127.0.0.1:3100'
    clearLaunchCredential(apiBaseUrl)
    const applied: Array<{ apiBaseUrl: string; credentialAtApply: string | null }> = []

    applyDaemonWorkspaceSnapshot(
      {
        revision: 1,
        workspaces: [{ id: 'workspace-a', backendUrl: apiBaseUrl, credential: 'runtime-only' }],
      },
      (request) => {
        applied.push({
          apiBaseUrl: request.apiBaseUrl,
          credentialAtApply: readLaunchCredential(request.apiBaseUrl),
        })
      }
    )

    expect(applied).toEqual([{ apiBaseUrl, credentialAtApply: 'runtime-only' }])
    clearLaunchCredential(apiBaseUrl)
  })
})
