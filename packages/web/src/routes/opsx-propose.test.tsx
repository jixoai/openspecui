/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Verify proposal terminal target selection and create-session dispatch.
 * 2. Verify Root Context locks all terminal dispatch actions before payload preparation.
 * 3. Verify prepared planning-root targets become stale across Root replacement.
 * 4. Prove the public Create boundary reaches the shell owner only when the target guard is bypassed.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 */
import type { TerminalShellProfile } from '@openspecui/core/terminal-invocation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxProposeRoute } from './opsx-propose'

const TEST_SHELL = {
  id: 'test:shell',
  label: 'Test shell',
  command: 'test-shell',
  args: [],
  source: 'builtin',
  quoteStyle: 'posix',
} satisfies TerminalShellProfile

const {
  createShellSessionMock,
  prepareWorkflowInvocationMock,
  requestCloseMock,
  rootActionMock,
  setConfigMock,
  writeToSessionMock,
  useTerminalContextMock,
  useTerminalInvocationConfigMock,
  workflowTargetGuardMock,
} = vi.hoisted(() => ({
  createShellSessionMock: vi.fn(),
  prepareWorkflowInvocationMock: vi.fn(),
  requestCloseMock: vi.fn(),
  rootActionMock: vi.fn(),
  setConfigMock: vi.fn(),
  writeToSessionMock: vi.fn(),
  useTerminalContextMock: vi.fn(),
  useTerminalInvocationConfigMock: vi.fn(),
  workflowTargetGuardMock: vi.fn(),
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
    initialCwdTarget,
    expectedRootGeneration,
    onCreated,
  }: {
    open: boolean
    command: { label: string } | null
    presetValues?: Record<string, string | boolean>
    initialCwdTarget?: string
    expectedRootGeneration?: string
    onCreated?: (sessionId: string) => void
  }) =>
    open ? (
      <div role="dialog" aria-label="Create terminal">
        <span>Create {command?.label}</span>
        <output>{String(presetValues?.prompt ?? '')}</output>
        <output data-testid="spawn-cwd-target">{initialCwdTarget ?? ''}</output>
        <output data-testid="spawn-root-generation">{expectedRootGeneration ?? ''}</output>
        <button
          type="button"
          onClick={() => {
            const sessionId = createShellSessionMock(TEST_SHELL, {
              cwdTarget: initialCwdTarget ?? 'launch-project',
              ...(expectedRootGeneration ? { expectedRootGeneration } : {}),
              label: command?.label ?? 'unknown',
              initialInput: `${String(presetValues?.prompt ?? '')}\n`,
            })
            if (sessionId) onCreated?.(sessionId)
          }}
        >
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
  useTerminalContext: () => ({
    ...useTerminalContextMock(),
    createShellSession: createShellSessionMock,
  }),
}))

vi.mock('@/lib/use-terminal-invocation-config', () => ({
  useTerminalInvocationConfig: () => useTerminalInvocationConfigMock(),
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => ({
    data: { opsx: { agentInvocationMode: 'compose' } },
  }),
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => rootActionMock(),
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

vi.mock('@/lib/opsx-workflow-invocation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/opsx-workflow-invocation')>()
  return {
    ...actual,
    prepareWorkflowInvocation: prepareWorkflowInvocationMock,
    isWorkflowTargetCurrent: (
      target: Parameters<typeof actual.isWorkflowTargetCurrent>[0],
      rootAction: Parameters<typeof actual.isWorkflowTargetCurrent>[1]
    ) => workflowTargetGuardMock(target, rootAction),
    stringifyWorkflowInvocation: vi.fn((result: { text: string }) => result.text),
    workflowDiagnosticsToText: vi.fn(() => null),
  }
})

describe('OpsxProposeRoute terminal target', () => {
  let queryClient: QueryClient

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('@/lib/opsx-workflow-invocation')>(
      '@/lib/opsx-workflow-invocation'
    )
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    requestCloseMock.mockReset()
    createShellSessionMock.mockReset().mockReturnValue('term-created')
    prepareWorkflowInvocationMock.mockReset().mockResolvedValue({
      kind: 'agent-prompt',
      text: 'prepared proposal prompt',
      format: 'markdown',
      mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
      target: null,
      evidence: null,
    })
    rootActionMock.mockReset().mockReturnValue({
      status: 'ready',
      disabled: false,
      context: null,
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    })
    setConfigMock.mockReset()
    workflowTargetGuardMock.mockReset().mockImplementation(actual.isWorkflowTargetCurrent)
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
    fireEvent.click(screen.getByRole('button', { name: 'Prepare' }))
    await waitFor(() => expect(prepareWorkflowInvocationMock).toHaveBeenCalled())
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

  it('binds a prepared workflow create to planning root and generation', async () => {
    const target = {
      launchProject: { path: '/launch' },
      planningRoot: { path: '/planning-a', source: 'nearest', healthy: true, status: [] },
      storeId: null,
      observedAt: 1,
      generation: 'planning-a-generation',
      rootSelector: {},
      references: [],
      diagnostics: { root: [], doctor: [], context: [] },
      rootEvidence: { doctor: null, context: null },
    }
    rootActionMock.mockReturnValue({
      status: 'ready',
      disabled: false,
      context: {
        planningRoot: target.planningRoot,
        storeId: target.storeId,
        generation: target.generation,
      },
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    })
    useTerminalContextMock.mockReturnValue({
      sessions: [
        {
          id: 'launch-old',
          displayTitle: 'Old Launch shell',
          cwdTarget: 'launch-project',
          isExited: false,
        },
      ],
      activeSessionId: 'launch-old',
    })
    prepareWorkflowInvocationMock.mockResolvedValue({
      kind: 'agent-prompt',
      text: 'prepared proposal prompt',
      format: 'markdown',
      mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
      target,
      evidence: null,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <OpsxProposeRoute />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Prepare' }))
    await waitFor(() => expect(screen.getByText('/planning-a')).toBeInTheDocument())
    expect(screen.getByTestId('opsx-propose-target-select')).not.toHaveTextContent(
      'Old Launch shell'
    )
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Create terminal' })).toBeTruthy()
    )

    expect(screen.getByTestId('spawn-cwd-target')).toHaveTextContent('planning-root')
    expect(screen.getByTestId('spawn-root-generation')).toHaveTextContent('planning-a-generation')
  })

  it('groups existing terminal targets separately from create targets', async () => {
    useTerminalContextMock.mockReturnValue({
      sessions: [
        {
          id: 'term-1',
          displayTitle: 'dev shell',
          cwdTarget: 'launch-project',
          initialCwd: '/launch',
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

    expect(within(shellGroup).getByRole('option', { name: 'dev shell · Launch' })).toBeTruthy()
    expect(within(createGroup).getByRole('option', { name: 'Create Claude' })).toBeTruthy()
  })

  it('locks terminal actions before Root Context succeeds', () => {
    rootActionMock.mockReturnValue({
      status: 'checking',
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Resolving planning root',
      message: 'Root-dependent actions remain locked.',
      evidence: [],
    })

    render(
      <QueryClientProvider client={queryClient}>
        <OpsxProposeRoute />
      </QueryClientProvider>
    )

    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(prepareWorkflowInvocationMock).not.toHaveBeenCalled()
  })

  it('retires a prepared A target and locks dispatch after Root B is observed', async () => {
    const target = {
      launchProject: { path: '/launch' },
      planningRoot: { path: '/planning-a', source: 'nearest', healthy: true, status: [] },
      storeId: null,
      observedAt: 1,
      generation: 'planning-a-generation',
      rootSelector: {},
      references: [],
      diagnostics: { root: [], doctor: [], context: [] },
      rootEvidence: { doctor: null, context: null },
    }
    const readyA = {
      status: 'ready',
      disabled: false,
      context: {
        planningRoot: target.planningRoot,
        storeId: null,
        observedAt: 1,
        generation: target.generation,
      },
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    }
    rootActionMock.mockReturnValue(readyA)
    prepareWorkflowInvocationMock.mockResolvedValue({
      kind: 'agent-prompt',
      text: 'prepared proposal prompt',
      format: 'markdown',
      mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
      target,
      evidence: null,
    })
    const view = render(
      <QueryClientProvider client={queryClient}>
        <OpsxProposeRoute />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Prepare' }))
    await waitFor(() => expect(screen.getByText('/planning-a')).toBeInTheDocument())

    rootActionMock.mockReturnValue({
      ...readyA,
      context: {
        planningRoot: { ...target.planningRoot, path: '/planning-b' },
        storeId: null,
        observedAt: 2,
        generation: 'planning-b-generation',
      },
      observedAt: 2,
    })
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <OpsxProposeRoute />
      </QueryClientProvider>
    )

    expect(screen.getByRole('button', { name: /^Create$/i })).toBeDisabled()
    expect(writeToSessionMock).not.toHaveBeenCalled()
  })

  it('proves the public Create boundary rejects Root A after the exact guard is restored', async () => {
    const target = {
      launchProject: { path: '/launch' },
      planningRoot: { path: '/planning-a', source: 'nearest', healthy: true, status: [] },
      storeId: null,
      observedAt: 1,
      generation: 'planning-a-generation',
      rootSelector: {},
      references: [],
      diagnostics: { root: [], doctor: [], context: [] },
      rootEvidence: { doctor: null, context: null },
    }
    const readyA = {
      status: 'ready' as const,
      disabled: false,
      context: {
        planningRoot: target.planningRoot,
        storeId: null,
        observedAt: target.observedAt,
        generation: target.generation,
      },
      observedAt: target.observedAt,
      title: null,
      message: null,
      evidence: [],
    }
    rootActionMock.mockReturnValue(readyA)
    prepareWorkflowInvocationMock.mockResolvedValue({
      kind: 'agent-prompt',
      text: 'prepared proposal prompt from Root A',
      format: 'markdown',
      mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
      target,
      evidence: null,
    })

    const view = render(
      <QueryClientProvider client={queryClient}>
        <OpsxProposeRoute />
      </QueryClientProvider>
    )
    fireEvent.change(
      screen.getByPlaceholderText('e.g. add workspace kanban support for active changes'),
      {
        target: { value: 'idea from Root A' },
      }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Prepare' }))
    await waitFor(() => expect(screen.getByText('/planning-a')).toBeInTheDocument())

    rootActionMock.mockReturnValue({
      ...readyA,
      context: {
        planningRoot: { ...target.planningRoot, path: '/planning-b' },
        storeId: null,
        observedAt: 2,
        generation: 'planning-b-generation',
      },
      observedAt: 2,
    })

    // Counterexample mutation: bypass only the target freshness guard at the public dispatch.
    workflowTargetGuardMock.mockReturnValue(true)
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <OpsxProposeRoute />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Create terminal' })).toBeTruthy()
    )
    fireEvent.click(screen.getByRole('button', { name: 'Create terminal' }))
    expect(createShellSessionMock).toHaveBeenCalledWith(
      TEST_SHELL,
      expect.objectContaining({
        cwdTarget: 'planning-root',
        expectedRootGeneration: 'planning-a-generation',
        initialInput: 'prepared proposal prompt from Root A\n',
      })
    )

    // Green evidence: restore the production helper without rerendering. The same public action
    // must now fail in preparePayload before opening another shell owner.
    const actual = await vi.importActual<typeof import('@/lib/opsx-workflow-invocation')>(
      '@/lib/opsx-workflow-invocation'
    )
    workflowTargetGuardMock.mockImplementation(actual.isWorkflowTargetCurrent)
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    await waitFor(() =>
      expect(
        screen.getByText('Planning root changed before dispatch. Prepare this workflow again.')
      ).toBeInTheDocument()
    )
    expect(createShellSessionMock).toHaveBeenCalledTimes(1)
  })
})
