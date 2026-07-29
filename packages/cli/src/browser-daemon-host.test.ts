/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Prove the daemon Browser host resolves private Workspace targets only at the opener boundary.
 * 2. Prove opener failures cannot reflect credentials or private launch fragments into daemon errors.
 *
 * Original request (2026-07-29): "Workspaces 的 tab 提供 open in browser。"
 */
import { describe, expect, it, vi } from 'vitest'
import { createBrowserDaemonHost } from './browser-daemon-host.js'
import type { LocalAppServer } from './local-app-server.js'

function createAppServer(): LocalAppServer {
  return {
    url: 'http://127.0.0.1:14000',
    setWorkspaces: vi.fn(),
    close: vi.fn(async () => {}),
  }
}

describe('Browser daemon host', () => {
  it('materializes a registered Workspace target only for the external opener', async () => {
    const targets: string[] = []
    const host = createBrowserDaemonHost({
      appServer: createAppServer(),
      openExternalUrl: async (target) => {
        targets.push(target)
      },
    })

    await host.openProjectInBrowser({
      id: 'workspace-a',
      backendUrl: 'http://127.0.0.1:3100',
      credential: 'runtime-only',
    })

    expect(targets).toHaveLength(1)
    const target = new URL(targets[0] ?? 'invalid:missing-target')
    expect(new URLSearchParams(target.hash.slice(1)).get('credential')).toBe('runtime-only')
  })

  it('returns a fixed credential-free error when the opener reflects its target', async () => {
    const host = createBrowserDaemonHost({
      appServer: createAppServer(),
      openExternalUrl: async (target) => {
        throw new Error(`Unable to open ${target}`)
      },
    })

    const failure = host.openProjectInBrowser({
      id: 'workspace-a',
      backendUrl: 'http://127.0.0.1:3100',
      credential: 'runtime-only',
    })
    await expect(failure).rejects.toThrow(
      'Failed to open the registered Workspace in the system browser.'
    )
    await expect(failure).rejects.not.toThrow('runtime-only')
  })
})
