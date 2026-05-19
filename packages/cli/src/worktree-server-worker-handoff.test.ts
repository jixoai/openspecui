import type { GitWorktreeHandoff } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { createParentPortWorktreeHandoffService } from './worktree-server-worker-handoff'

describe('worktree worker handoff protocol', () => {
  it('delegates nested worktree switches to the parent owner instead of spawning locally', async () => {
    const handoff: GitWorktreeHandoff = {
      projectDir: '/repo/.worktree/feature',
      serverUrl: 'http://localhost:3104',
    }
    const postMessage = vi.fn()
    const port = {
      postMessage,
      on: vi.fn((event: string, listener: (message: unknown) => void) => {
        if (event === 'message') {
          queueMicrotask(() => {
            listener({ type: 'worktree-handoff:result', requestId: 'request-1', handoff })
          })
        }
        return port
      }),
      off: vi.fn(),
    }

    const service = createParentPortWorktreeHandoffService(port)
    await expect(
      service.ensureWorktreeServer({ targetPath: '/repo/.worktree/feature' })
    ).resolves.toEqual(handoff)

    expect(postMessage).toHaveBeenCalledWith({
      type: 'worktree-handoff:request',
      requestId: 'request-1',
      targetPath: '/repo/.worktree/feature',
    })
  })
})
