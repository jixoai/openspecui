/**
 * Orthogonal intents (updated 2026-07-15 Asia/Shanghai):
 * 1. Verify ordered CLI stream execution and immediate state visibility.
 * 2. Preserve multiline failure evidence and stop the queue after nonzero exit.
 *
 * Original request (2026-07-15): "场景丢失保护的诊断必须原样显示，不能合成重试。"
 */
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { setStreamEvents, subscribeMock } = vi.hoisted(() => {
  let streamEvents: unknown[] = []
  return {
    setStreamEvents: (events: unknown[]) => {
      streamEvents = events
    },
    subscribeMock: vi.fn((_input: unknown, handlers: { onData: (event: unknown) => void }) => {
      for (const event of streamEvents) handlers.onData(event)
      return { unsubscribe: vi.fn() }
    }),
  }
})

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

import { CliTerminal } from '../components/cli-terminal'
import { useCliRunner } from './use-cli-runner'

describe('useCliRunner', () => {
  beforeEach(() => {
    subscribeMock.mockClear()
    setStreamEvents([
      { type: 'command', data: 'openspec config list --json' },
      { type: 'stdout', data: '{"profile":"core"}\n' },
      { type: 'exit', exitCode: 0 },
    ])
  })

  afterEach(() => {
    cleanup()
  })

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

  it('renders scenario-loss diagnostics verbatim and does not start a synthesized retry', async () => {
    const diagnostic = [
      'archive_spec_update_failed',
      'MODIFIED requirement would remove existing scenarios:',
      '- Scenario: Existing behavior',
    ].join('\n')
    setStreamEvents([
      { type: 'command', data: 'openspec archive -y add-search' },
      { type: 'stderr', data: diagnostic },
      { type: 'exit', exitCode: 1 },
    ])
    const { result } = renderHook(() => useCliRunner())

    act(() => {
      result.current.commands.replaceAll([
        { command: 'openspec', args: ['archive', '-y', 'add-search'] },
        { command: 'openspec', args: ['archive', '-y', 'add-search', '--no-validate'] },
      ])
    })

    await act(async () => {
      await result.current.commands.runAll()
    })

    expect(subscribeMock).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('error')

    const { container } = render(<CliTerminal lines={result.current.lines} />)
    const terminalText = container.textContent ?? ''
    expect(terminalText).toContain(diagnostic)
    expect(
      Array.from(container.querySelectorAll('.whitespace-pre-wrap')).some((line) =>
        line.textContent?.includes('archive_spec_update_failed')
      )
    ).toBe(true)
  })
})
