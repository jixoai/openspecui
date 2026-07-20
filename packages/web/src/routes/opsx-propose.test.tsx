/**
 * Orthogonal intents (updated 2026-07-21 Asia/Shanghai):
 * 1. Verify the real Propose Create -> TerminalSpawnCommandDialog -> shell owner chain.
 * 2. Verify Root Context locks all terminal dispatch actions before payload preparation.
 * 3. Verify prepared planning-root targets become stale across Root replacement.
 * 4. Verify typed shell, command, cwd, prompt, and generation evidence at the shell owner.
 *
 * Original request (2026-07-21): "Propose: only traverse the real TerminalSpawnCommandDialog -> createShellSession chain."
 * Owner correction (2026-07-21): "Each item must have one production owner, one precise red case, and one green case."
 */
import type {
  TerminalShellProfile,
  TerminalSpawnCommand,
} from '@openspecui/core/terminal-invocation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxProposeRoute } from './opsx-propose'

const TEST_SHELL = {
  id: 'builtin:zsh',
  label: 'zsh',
  command: 'zsh',
  args: [],
  source: 'builtin',
  quoteStyle: 'posix',
} satisfies TerminalShellProfile

const TEST_COMMAND = {
  id: 'builtin:claude',
  label: 'Claude',
  command: 'claude',
  args: [
    {
      kind: 'field',
      fieldId: 'prompt',
      prefix: '',
      omitWhenEmpty: true,
    },
  ],
  fields: [
    {
      id: 'prompt',
      label: 'Prompt',
      type: 'textarea',
      options: [],
      defaultValue: '',
      required: false,
      advanced: false,
    },
  ],
  source: 'builtin',
} satisfies TerminalSpawnCommand

const {
  createShellSessionMock,
  prepareWorkflowInvocationMock,
  requestCloseMock,
  rootActionMock,
  setConfigMock,
  writeToSessionMock,
  useTerminalContextMock,
  useTerminalInvocationConfigMock,
  useTerminalCwdTargetStateMock,
} = vi.hoisted(() => ({
  createShellSessionMock: vi.fn(),
  prepareWorkflowInvocationMock: vi.fn(),
  requestCloseMock: vi.fn(),
  rootActionMock: vi.fn(),
  setConfigMock: vi.fn(),
  writeToSessionMock: vi.fn(),
  useTerminalContextMock: vi.fn(),
  useTerminalInvocationConfigMock: vi.fn(),
  useTerminalCwdTargetStateMock: vi.fn(),
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

vi.mock('@/lib/use-terminal-cwd-target', () => ({
  useTerminalCwdTargetState: () => useTerminalCwdTargetStateMock(),
  getTerminalCwdTargetOption: (
    state: { launchProject: unknown; planningRoot: unknown },
    target: 'launch-project' | 'planning-root'
  ) => (target === 'planning-root' ? state.planningRoot : state.launchProject),
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
    stringifyWorkflowInvocation: vi.fn((result: { text: string }) => result.text),
    workflowDiagnosticsToText: vi.fn(() => null),
  }
})

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
    writeToSessionMock.mockReset()
    useTerminalContextMock.mockReturnValue({
      sessions: [],
      activeSessionId: null,
    })
    useTerminalInvocationConfigMock.mockReturnValue({
      shellProfiles: [TEST_SHELL],
      defaultShellProfile: TEST_SHELL,
      spawnCommands: [TEST_COMMAND],
    })
    useTerminalCwdTargetStateMock.mockReturnValue({
      launchProject: {
        target: 'launch-project',
        label: 'Launch project',
        path: '/launch',
        available: true,
        unavailableReason: null,
      },
      planningRoot: {
        target: 'planning-root',
        label: 'Planning root',
        path: '/planning-a',
        available: true,
        unavailableReason: null,
      },
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
        storeId: null,
        generation: target.generation,
      },
      observedAt: target.observedAt,
      title: null,
      message: null,
      evidence: [],
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

    expect(screen.getByTestId('opsx-propose-target-select').textContent).toContain('Create Claude')
    fireEvent.click(screen.getByRole('button', { name: 'Prepare' }))
    await waitFor(() => expect(screen.getByText('/planning-a')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Create Claude' })
    expect(await within(dialog).findByDisplayValue('prepared proposal prompt')).toBeVisible()
    expect(within(dialog).getByText('/planning-a')).toBeVisible()
    expect(within(dialog).getByText("claude 'prepared proposal prompt'")).toBeVisible()
    expect(writeToSessionMock).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(createShellSessionMock).toHaveBeenCalledTimes(1)
    expect(createShellSessionMock).toHaveBeenCalledWith(TEST_SHELL, {
      cwdTarget: 'planning-root',
      expectedRootGeneration: 'planning-a-generation',
      label: 'Claude',
      initialInput: "claude 'prepared proposal prompt'\n",
    })
    expect(requestCloseMock).toHaveBeenCalledTimes(1)
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
    await waitFor(() => expect(screen.getAllByText('/planning-a').length).toBeGreaterThan(0))
    expect(screen.getByTestId('opsx-propose-target-select')).not.toHaveTextContent(
      'Old Launch shell'
    )
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Claude' })

    expect(await within(dialog).findByDisplayValue('prepared proposal prompt')).toBeVisible()
    expect(within(dialog).getByText('/planning-a')).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(createShellSessionMock).toHaveBeenCalledWith(TEST_SHELL, {
      cwdTarget: 'planning-root',
      expectedRootGeneration: 'planning-a-generation',
      label: 'Claude',
      initialInput: "claude 'prepared proposal prompt'\n",
    })
    expect(requestCloseMock).toHaveBeenCalledTimes(1)
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

})
