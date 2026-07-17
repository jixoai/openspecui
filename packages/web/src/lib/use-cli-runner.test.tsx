/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Verify ordered CLI stream execution and immediate state visibility.
 * 2. Preserve multiline failure evidence and stop the queue after nonzero exit.
 * 3. Prove every queue item selects one exhaustive dedicated Server transport.
 * 4. Prove logical previews are derived and backend command evidence becomes authoritative.
 *
 * Original request (2026-07-15): "场景丢失保护的诊断必须原样显示，不能合成重试。"
 * Original request (2026-07-17): "CliStreamTransport is the single execution and display truth."
 */
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  archiveStrictSubscribeMock,
  initSubscribeMock,
  installSubscribeMock,
  setStreamEvents,
  updateSubscribeMock,
  validateSubscribeMock,
} = vi.hoisted(() => {
  let streamEvents: unknown[] = []
  const createSubscribeMock = () =>
    vi.fn(
      (
        _input: unknown,
        handlers: { onData: (event: unknown) => void; onError?: (error: unknown) => void }
      ) => {
        for (const event of streamEvents) handlers.onData(event)
        return { unsubscribe: vi.fn() }
      }
    )
  return {
    archiveStrictSubscribeMock: vi.fn(
      (
        _input: unknown,
        handlers: { onData: (event: unknown) => void; onError?: (error: unknown) => void }
      ) => {
        for (const event of streamEvents) handlers.onData(event)
        return { unsubscribe: vi.fn() }
      }
    ),
    initSubscribeMock: createSubscribeMock(),
    installSubscribeMock: createSubscribeMock(),
    setStreamEvents: (events: unknown[]) => {
      streamEvents = events
    },
    updateSubscribeMock: createSubscribeMock(),
    validateSubscribeMock: createSubscribeMock(),
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
      initStream: {
        subscribe: initSubscribeMock,
      },
      installGlobalCliStream: {
        subscribe: installSubscribeMock,
      },
      updateStream: {
        subscribe: updateSubscribeMock,
      },
      validateStream: {
        subscribe: validateSubscribeMock,
      },
    },
  },
}))

import { CliTerminal } from '../components/cli-terminal'
import { type CommandProcess, useCliRunner } from './use-cli-runner'

type QueuedCommandInput = Parameters<
  ReturnType<typeof useCliRunner>['commands']['replaceAll']
>[0][number]

function queuedCommand(input: QueuedCommandInput): QueuedCommandInput {
  return input
}

describe('useCliRunner', () => {
  beforeEach(() => {
    archiveStrictSubscribeMock.mockClear()
    initSubscribeMock.mockClear()
    installSubscribeMock.mockClear()
    updateSubscribeMock.mockClear()
    validateSubscribeMock.mockClear()
    setStreamEvents([
      { type: 'command', data: 'pnpm exec openspec validate demo --type change' },
      { type: 'stdout', data: '{"profile":"core"}\n' },
      { type: 'exit', exitCode: 0 },
    ])
  })

  afterEach(() => {
    cleanup()
  })

  it('derives preview and execution from one transport without requiring an extra render', async () => {
    const { result } = renderHook(() => useCliRunner())

    act(() => {
      result.current.commands.replaceAll([
        { type: 'validate', input: { id: 'demo', type: 'change' } },
      ])
    })

    await act(async () => {
      await result.current.commands.runAll()
    })

    await waitFor(() => {
      expect(validateSubscribeMock).toHaveBeenCalledTimes(1)
    })
    expect(result.current.commands.list()).toEqual([
      expect.objectContaining({
        command: 'openspec',
        args: ['validate', 'demo', '--type', 'change'],
        effectiveCommand: 'pnpm exec openspec validate demo --type change',
      }),
    ])
    expect(result.current.status).toBe('success')
  })

  it('uses the dedicated Server stream for strict archive requests', async () => {
    const { result } = renderHook(() => useCliRunner())

    act(() => {
      result.current.commands.replaceAll([
        {
          type: 'archive-strict',
          input: { changeId: 'add-search', skipSpecs: false, noValidate: false },
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
    expect(result.current.status).toBe('success')
  })

  it('uses the fixed Server-owned stream for global CLI installation', async () => {
    const { result } = renderHook(() => useCliRunner())

    act(() => {
      result.current.commands.replaceAll([{ type: 'install-global-cli' }])
    })

    await act(async () => {
      await result.current.commands.runAll()
    })

    expect(installSubscribeMock).toHaveBeenCalledWith(undefined, expect.any(Object))
    expect(result.current.status).toBe('success')
  })

  it('settles an emitted terminal transport error instead of leaving the command running', async () => {
    installSubscribeMock.mockImplementationOnce((_input, handlers) => {
      queueMicrotask(() =>
        handlers.onError?.(new Error('forced termination did not confirm child close'))
      )
      return { unsubscribe: vi.fn() }
    })
    const processes: CommandProcess[] = []
    const { result } = renderHook(() =>
      useCliRunner({ onCreateProcess: (process) => processes.push(process) })
    )

    act(() => {
      result.current.commands.replaceAll([{ type: 'install-global-cli' }])
    })

    await act(async () => {
      await result.current.commands.runAll()
    })

    expect(processes).toHaveLength(1)
    await expect(processes[0]!.done).resolves.toBeNull()
    expect(result.current.status).toBe('error')
    expect(result.current.commands.list()).toEqual([
      expect.objectContaining({ status: 'error', exitCode: null }),
    ])
  })

  it.each([
    [
      'Init',
      queuedCommand({
        type: 'init',
        input: { tools: ['claude'], force: true },
      }),
      initSubscribeMock,
      { tools: ['claude'], force: true },
    ],
    [
      'Planning-root Update',
      queuedCommand({
        type: 'planning-root-update',
      }),
      updateSubscribeMock,
      undefined,
    ],
    [
      'Validate',
      queuedCommand({
        type: 'validate',
        input: { id: 'demo', type: 'change', strict: true },
      }),
      validateSubscribeMock,
      { id: 'demo', type: 'change', strict: true },
    ],
  ] as const)(
    'uses the typed Server-owned stream for %s',
    async (_label, descriptor, expectedSubscribe, expectedInput) => {
      const { result } = renderHook(() => useCliRunner())

      act(() => {
        result.current.commands.replaceAll([descriptor])
      })

      await act(async () => {
        await result.current.commands.runAll()
      })

      expect(expectedSubscribe).toHaveBeenCalledWith(expectedInput, expect.any(Object))
      expect(result.current.status).toBe('success')
    }
  )

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
        {
          type: 'archive-strict',
          input: { changeId: 'add-search', skipSpecs: false, noValidate: false },
        },
      ])
    })

    await act(async () => {
      await result.current.commands.runAll()
    })

    expect(archiveStrictSubscribeMock).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('error')
    expect(result.current.commands.list()).toEqual([
      expect.objectContaining({
        args: ['archive', '-y', 'add-search'],
        status: 'error',
        stream: {
          type: 'archive-strict',
          input: { changeId: 'add-search', skipSpecs: false, noValidate: false },
        },
      }),
    ])
    expect(result.current.commands.list().flatMap((command) => command.args)).not.toContain(
      '--no-validate'
    )

    const { container } = render(<CliTerminal lines={result.current.lines} />)
    const terminalText = container.textContent ?? ''
    expect(terminalText).toContain(diagnostic)
    expect(
      Array.from(container.querySelectorAll('.whitespace-pre-wrap')).some((line) =>
        line.textContent?.includes('archive_spec_update_failed')
      )
    ).toBe(true)
  })

  it.each([
    ['failed', 1],
    ['indeterminate', null],
  ])('keeps a %s strict preflight inside one Server-owned stream', async (_label, exitCode) => {
    const diagnostic = 'archive_validation_failed\nThe change did not pass strict validation.'
    setStreamEvents([
      {
        type: 'command',
        data: 'openspec validate add-search --type change --strict',
      },
      { type: 'stderr', data: diagnostic },
      { type: 'exit', exitCode },
    ])
    const { result } = renderHook(() => useCliRunner())

    act(() => {
      result.current.commands.replaceAll([
        {
          type: 'archive-strict',
          input: { changeId: 'add-search', skipSpecs: false, noValidate: false },
        },
      ])
    })

    await act(async () => {
      await result.current.commands.runAll()
    })

    expect(archiveStrictSubscribeMock).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('error')
    expect(
      result.current.lines.map((line) => ('text' in line ? line.text : '')).join('\n')
    ).toContain(diagnostic)
  })
})
