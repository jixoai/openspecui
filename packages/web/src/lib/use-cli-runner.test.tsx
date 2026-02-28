import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const subscribeMock = vi.hoisted(() =>
  vi.fn((_input: unknown, handlers: { onData: (event: unknown) => void }) => {
    handlers.onData({ type: 'command', data: 'openspec config list --json' })
    handlers.onData({ type: 'stdout', data: '{"profile":"core"}\n' })
    handlers.onData({ type: 'exit', exitCode: 0 })
    return { unsubscribe: vi.fn() }
  })
)

vi.mock('./static-mode', () => ({
  isStaticMode: () => false,
}))

vi.mock('./trpc', () => ({
  trpcClient: {
    cli: {
      runCommandStream: {
        subscribe: subscribeMock,
      },
    },
  },
}))

import { useCliRunner } from './use-cli-runner'

describe('useCliRunner', () => {
  it('runs commands after replaceAll + runAll without requiring an extra render', async () => {
    const { result } = renderHook(() => useCliRunner())

    act(() => {
      result.current.commands.replaceAll([
        {
          command: 'openspec',
          args: ['config', 'list', '--json'],
        },
      ])
    })

    await act(async () => {
      await result.current.commands.runAll()
    })

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalledTimes(1)
    })
    expect(result.current.status).toBe('success')
  })
})
