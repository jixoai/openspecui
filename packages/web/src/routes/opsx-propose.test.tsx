import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxProposeRoute } from './opsx-propose'

const {
  requestCloseMock,
  setConfigMock,
  writeToSessionMock,
  useTerminalContextMock,
  useTerminalInvocationConfigMock,
} = vi.hoisted(() => ({
  requestCloseMock: vi.fn(),
  setConfigMock: vi.fn(),
  writeToSessionMock: vi.fn(),
  useTerminalContextMock: vi.fn(),
  useTerminalInvocationConfigMock: vi.fn(),
}))

vi.mock('@/components/layout/pop-area', () => ({
  usePopAreaConfigContext: () => ({
    setConfig: setConfigMock,
  }),
  usePopAreaLifecycleContext: () => ({
    requestClose: requestCloseMock,
  }),
}))

vi.mock('@/components/code-editor', () => ({
  CodeEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }) => (
    <textarea
      aria-label="Idea"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

vi.mock('@/components/terminal/terminal-spawn-command-dialog', () => ({
  TerminalSpawnCommandDialog: ({
    open,
    command,
    presetValues,
    onCreated,
  }: {
    open: boolean
    command: { label: string } | null
    presetValues?: Record<string, string | boolean>
    onCreated?: (sessionId: string) => void
  }) =>
    open ? (
      <div role="dialog" aria-label="Create terminal">
        <span>Create {command?.label}</span>
        <output>{String(presetValues?.prompt ?? '')}</output>
        <button type="button" onClick={() => onCreated?.('term-created')}>
          Create terminal
        </button>
      </div>
    ) : null,
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    activatePop: vi.fn(),
  },
}))

vi.mock('@/lib/terminal-controller', () => ({
  terminalController: {
    writeToSession: writeToSessionMock,
    addInputHistory: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => useTerminalContextMock(),
}))

vi.mock('@/lib/use-terminal-invocation-config', () => ({
  useTerminalInvocationConfig: () => useTerminalInvocationConfigMock(),
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => ({
    data: { opsx: { agentInvocationMode: 'compose' } },
  }),
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    config: {
      update: {
        mutate: vi.fn().mockResolvedValue({}),
      },
    },
  },
}))

vi.mock('@/lib/opsx-workflow-invocation', () => ({
  prepareWorkflowInvocation: vi.fn().mockResolvedValue({
    kind: 'agent-prompt',
    text: 'prepared proposal prompt',
    format: 'markdown',
    mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
  }),
  stringifyWorkflowInvocation: vi.fn(() => 'prepared proposal prompt'),
  workflowDiagnosticsToText: vi.fn(() => null),
}))

describe('OpsxProposeRoute terminal target', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    requestCloseMock.mockReset()
    setConfigMock.mockReset()
    writeToSessionMock.mockReset()
    useTerminalContextMock.mockReturnValue({
      sessions: [],
      activeSessionId: null,
    })
    useTerminalInvocationConfigMock.mockReturnValue({
      spawnCommands: [
        {
          id: 'builtin:claude',
          label: 'Claude',
          command: 'claude',
          args: [],
          fields: [],
          source: 'builtin',
        },
      ],
    })
  })

  afterEach(() => {
    cleanup()
    queryClient.clear()
  })

  it('blocks outside dismiss for the propose form dialog', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OpsxProposeRoute />
      </QueryClientProvider>
    )

    expect(setConfigMock).toHaveBeenCalledWith(expect.objectContaining({ onDismissRequest: null }))
  })

  it('opens the shared spawn dialog with prepared payload when target is create', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OpsxProposeRoute />
      </QueryClientProvider>
    )

    expect(screen.getByTestId('opsx-propose-target-select').textContent).toContain('Create Claude')
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Create terminal' })).toBeTruthy()
    })

    const dialog = screen.getByRole('dialog', { name: 'Create terminal' })
    expect(within(dialog).getByText('Create Claude')).toBeTruthy()
    expect(within(dialog).getByText('prepared proposal prompt')).toBeTruthy()
    expect(writeToSessionMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Create terminal' }))

    expect(requestCloseMock).toHaveBeenCalled()
  })

  it('groups existing terminal targets separately from create targets', async () => {
    useTerminalContextMock.mockReturnValue({
      sessions: [
        {
          id: 'term-1',
          displayTitle: 'dev shell',
          isExited: false,
        },
      ],
      activeSessionId: 'term-1',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <OpsxProposeRoute />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Target' }))

    const shellGroup = await screen.findByRole('group', { name: 'Shell Instances' })
    const createGroup = screen.getByRole('group', { name: 'Create Shell Instance' })

    expect(within(shellGroup).getByRole('option', { name: 'dev shell' })).toBeTruthy()
    expect(within(createGroup).getByRole('option', { name: 'Create Claude' })).toBeTruthy()
  })
})
