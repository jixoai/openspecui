/**
 * Orthogonal intents (updated 2026-07-15 Asia/Shanghai):
 * 1. Verify ordered CLI stream execution and immediate state visibility.
 * 2. Preserve multiline failure evidence and stop the queue after nonzero exit.
 * 3. Keep arbitrary commands outside the public OpenSpec execution transport.
 *
 * Original request (2026-07-15): "场景丢失保护的诊断必须原样显示，不能合成重试。"
 */
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { archiveStrictSubscribeMock, installSubscribeMock, setStreamEvents, subscribeMock } =
  vi.hoisted(() => {
    let streamEvents: unknown[] = []
    const createSubscribeMock = () =>
      vi.fn((_input: unknown, handlers: { onData: (event: unknown) => void }) => {
        for (const event of streamEvents) handlers.onData(event)
        return { unsubscribe: vi.fn() }
      })
    return {
      archiveStrictSubscribeMock: vi.fn(
        (_input: unknown, handlers: { onData: (event: unknown) => void }) => {
          for (const event of streamEvents) handlers.onData(event)
          return { unsubscribe: vi.fn() }
        }
      ),
      installSubscribeMock: createSubscribeMock(),
      setStreamEvents: (events: unknown[]) => {
        streamEvents = events
      },
      subscribeMock: createSubscribeMock(),
    }
  })

vi.mock('./static-mode', () => ({
  isStaticMode: () => false,
}))

vi.mock('./trpc', () => ({
  trpcClient: {
    cli: {
      archiveStrictStream: {
        subscribe: archiveStrictSubscribeMock,
      },
      executeOpenSpecStream: {
        subscribe: subscribeMock,
      },
      installGlobalCliStream: {
        subscribe: installSubscribeMock,
      },
    },
  },
}))

import { CliTerminal } from '../components/cli-terminal'
import { useCliRunner } from './use-cli-runner'

describe('useCliRunner', () => {
  beforeEach(() => {
    archiveStrictSubscribeMock.mockClear()
    installSubscribeMock.mockClear()
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

  it('uses the dedicated Server stream for strict archive requests', async () => {
    const { result } = renderHook(() => useCliRunner())

    act(() => {
      result.current.commands.replaceAll([
        {
          command: 'openspec',
          args: ['archive', '-y', 'add-search'],
          stream: {
            type: 'archive-strict',
            input: { changeId: 'add-search', skipSpecs: false, noValidate: false },
          },
        },
      ])
    })

    await act(async () => {
      await result.current.commands.runAll()
    })

    expect(archiveStrictSubscribeMock).toHaveBeenCalledWith(
      { changeId: 'add-search', skipSpecs: false, noValidate: false },
      expect.any(Object)
    )
    expect(subscribeMock).not.toHaveBeenCalled()
    expect(result.current.status).toBe('success')
  })

  it('uses the fixed Server-owned stream for global CLI installation', async () => {
    const { result } = renderHook(() => useCliRunner())

    act(() => {
      result.current.commands.replaceAll([
        {
          command: 'npm',
          args: ['install', '-g', '@fission-ai/openspec'],
          stream: { type: 'install-global-cli' },
        },
      ])
    })

    await act(async () => {
      await result.current.commands.runAll()
    })

    expect(installSubscribeMock).toHaveBeenCalledWith(undefined, expect.any(Object))
    expect(subscribeMock).not.toHaveBeenCalled()
    expect(result.current.status).toBe('success')
  })

  it('rejects arbitrary commands without a dedicated Server transport', async () => {
    const { result } = renderHook(() => useCliRunner())

    act(() => {
      result.current.commands.replaceAll([
        { command: 'node', args: ['openspec', 'archive', 'add-search'] },
      ])
    })

    await act(async () => {
      await result.current.commands.runAll()
    })

    expect(archiveStrictSubscribeMock).not.toHaveBeenCalled()
    expect(installSubscribeMock).not.toHaveBeenCalled()
    expect(subscribeMock).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
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
    expect(result.current.commands.list().map((command) => command.status)).toEqual([
      'error',
      'idle',
    ])

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
