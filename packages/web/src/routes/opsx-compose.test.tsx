/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Verify the change workflow dialog preserves route action and invocation-mode inputs.
 * 2. Verify the shared terminal dispatch surface remains available.
 * 3. Verify server-owned planning-root and Store targets remain visible before dispatch.
 * 4. Verify failed Root Context prevents preparation and every terminal dispatch action.
 * 5. Verify same-generation refresh and Root replacement never overwrite operator edits.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxComposeRoute } from './opsx-compose'

const WORKFLOW_TARGET = {
  launchProject: { path: '/launch' },
  planningRoot: {
    path: '/stores/shared',
    source: 'store' as const,
    store_id: 'shared',
    healthy: true,
    status: [],
  },
  storeId: 'shared',
  observedAt: 1,
  generation: 'planning-shared-generation',
  rootSelector: { store: 'shared' },
  references: [],
  diagnostics: { root: [], doctor: [], context: [] },
  rootEvidence: { doctor: null, context: null },
}

const {
  prepareWorkflowInvocationMock,
  rootActionMock,
  setConfigMock,
  uiConfigMock,
  useLocationMock,
} = vi.hoisted(() => ({
  prepareWorkflowInvocationMock: vi.fn(),
  rootActionMock: vi.fn(),
  setConfigMock: vi.fn(),
  uiConfigMock: vi.fn(),
  useLocationMock: vi.fn(),
}))

vi.mock('@/components/layout/pop-area', () => ({
  usePopAreaConfigContext: () => ({
    setConfig: setConfigMock,
  }),
  usePopAreaLifecycleContext: () => ({
    requestClose: vi.fn(),
  }),
}))

vi.mock('@/components/code-editor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea
      aria-label="Prompt"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({
    sessions: [],
    activeSessionId: null,
  }),
}))

vi.mock('@/lib/use-terminal-invocation-config', () => ({
  useTerminalInvocationConfig: () => ({
    shellProfiles: [
      {
        id: 'builtin:zsh',
        label: 'zsh',
        command: 'zsh',
        args: [],
        source: 'builtin',
        quoteStyle: 'posix',
      },
    ],
    defaultShellProfile: {
      id: 'builtin:zsh',
      label: 'zsh',
      command: 'zsh',
      args: [],
      source: 'builtin',
      quoteStyle: 'posix',
    },
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
  }),
}))

vi.mock('@/lib/use-terminal-cwd-target', () => ({
  useTerminalCwdTargetState: () => ({
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
      path: '/stores/shared',
      available: true,
      unavailableReason: null,
    },
  }),
  getTerminalCwdTargetOption: (
    state: { launchProject: unknown; planningRoot: unknown },
    target: 'launch-project' | 'planning-root'
  ) => (target === 'planning-root' ? state.planningRoot : state.launchProject),
}))

vi.mock('@/lib/terminal-controller', () => ({
  terminalController: {
    writeToSession: vi.fn(),
    addInputHistory: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => uiConfigMock(),
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => rootActionMock(),
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

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => useLocationMock(),
}))

describe('OpsxComposeRoute', () => {
  beforeEach(() => {
    prepareWorkflowInvocationMock.mockReset().mockResolvedValue({
      kind: 'agent-prompt',
      text: 'prepared prompt',
      format: 'markdown',
      mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
      target: WORKFLOW_TARGET,
      evidence: null,
    })
    setConfigMock.mockReset()
    rootActionMock.mockReset().mockReturnValue({
      status: 'ready',
      disabled: false,
      context: null,
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    })
    uiConfigMock.mockReset().mockReturnValue({
      data: { opsx: { agentInvocationMode: 'compose' } },
    })
    useLocationMock.mockReturnValue({
      pathname: '/opsx-compose',
      search: '?action=archive&change=add-terminal-spawn-command',
      hash: '',
      state: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('blocks outside dismiss for change detail compose workflow dialogs', async () => {
    render(<OpsxComposeRoute />)

    expect(setConfigMock).toHaveBeenCalledWith(expect.objectContaining({ onDismissRequest: null }))
    await waitFor(() => {
      expect(screen.getByLabelText('Prompt')).toHaveValue('prepared prompt')
    })
  })

  it('uses shared terminal dispatch actions with create targets', async () => {
    render(<OpsxComposeRoute />)

    await waitFor(() => {
      expect(screen.getByTestId('terminal-dispatch-target-select').textContent).toContain(
        'Create Claude'
      )
    })
  })

  it('shows the CLI-selected planning root and Store before dispatch', async () => {
    render(<OpsxComposeRoute />)

    await waitFor(() => {
      expect(screen.getByText('/stores/shared')).toBeInTheDocument()
      expect(screen.getByText('store · Store shared')).toBeInTheDocument()
    })
  })

  it('retains complete CLI evidence in a secondary disclosure', async () => {
    prepareWorkflowInvocationMock.mockResolvedValue({
      kind: 'agent-prompt',
      text: 'prepared prompt',
      format: 'markdown',
      mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
      target: WORKFLOW_TARGET,
      evidence: {
        kind: 'workflow-status',
        options: { store: 'shared' },
        result: {
          success: false,
          stdout: '{"changeRoot":"/stores/shared/openspec/changes/add-search"}',
          stderr: 'status warning',
          exitCode: 1,
          data: null,
          payload: { changeRoot: '/stores/shared/openspec/changes/add-search' },
          diagnostics: [],
          contractError: 'artifacts: Required',
        },
      },
    })

    render(<OpsxComposeRoute />)

    await waitFor(() => {
      expect(screen.getByText('CLI evidence')).toBeInTheDocument()
    })
    const evidence = screen.getByText('CLI evidence').parentElement
    expect(evidence).toHaveTextContent('workflow-status')
    expect(evidence).toHaveTextContent('status warning')
    expect(evidence).toHaveTextContent('artifacts: Required')
    expect(evidence).toHaveTextContent('/stores/shared/openspec/changes/add-search')
  })

  it('does not prepare or dispatch while Root Context is blocked', async () => {
    rootActionMock.mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Planning root unavailable',
      message: 'OpenSpec Doctor rejected the selected Store.',
      evidence: ['Doctor exit: 1'],
    })

    render(<OpsxComposeRoute />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Doctor exit: 1')
    })
    expect(prepareWorkflowInvocationMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
  })

  it('preserves a dirty prompt across same-generation Root Context refresh', async () => {
    const readyA = {
      status: 'ready' as const,
      disabled: false,
      context: {
        planningRoot: WORKFLOW_TARGET.planningRoot,
        storeId: WORKFLOW_TARGET.storeId,
        generation: WORKFLOW_TARGET.generation,
        observedAt: 1,
      },
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    }
    rootActionMock.mockReturnValue(readyA)

    const view = render(<OpsxComposeRoute />)
    await waitFor(() => expect(screen.getByLabelText('Prompt')).toHaveValue('prepared prompt'))

    fireEvent.change(screen.getByLabelText('Prompt'), {
      target: { value: 'edited prompt' },
    })
    expect(screen.getByLabelText('Prompt')).toHaveValue('edited prompt')

    rootActionMock.mockReturnValue({
      ...readyA,
      context: { ...readyA.context, observedAt: 2 },
      observedAt: 2,
    })
    view.rerender(<OpsxComposeRoute />)

    await waitFor(() => expect(screen.getByLabelText('Prompt')).toHaveValue('edited prompt'))
    expect(prepareWorkflowInvocationMock).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('/stores/shared').length).toBeGreaterThan(0)
  })

  it('keeps an edited prompt while re-preparing the target after Root A to B', async () => {
    const targetB = {
      ...WORKFLOW_TARGET,
      planningRoot: {
        ...WORKFLOW_TARGET.planningRoot,
        path: '/stores/next',
        store_id: 'next',
      },
      storeId: 'next',
      generation: 'planning-next-generation',
      rootSelector: { store: 'next' },
    }
    const readyA = {
      status: 'ready' as const,
      disabled: false,
      context: {
        planningRoot: WORKFLOW_TARGET.planningRoot,
        storeId: WORKFLOW_TARGET.storeId,
        generation: WORKFLOW_TARGET.generation,
        observedAt: 1,
      },
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    }
    prepareWorkflowInvocationMock
      .mockResolvedValueOnce({
        kind: 'agent-prompt',
        text: 'prepared prompt A',
        format: 'markdown',
        mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
        target: WORKFLOW_TARGET,
        evidence: null,
      })
      .mockResolvedValueOnce({
        kind: 'agent-prompt',
        text: 'prepared prompt B',
        format: 'markdown',
        mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
        target: targetB,
        evidence: null,
      })
    rootActionMock.mockReturnValue(readyA)

    const view = render(<OpsxComposeRoute />)
    await waitFor(() => expect(screen.getByLabelText('Prompt')).toHaveValue('prepared prompt A'))
    fireEvent.change(screen.getByLabelText('Prompt'), {
      target: { value: 'edited prompt for the operator' },
    })

    rootActionMock.mockReturnValue({
      ...readyA,
      context: {
        planningRoot: targetB.planningRoot,
        storeId: targetB.storeId,
        generation: targetB.generation,
        observedAt: 2,
      },
      observedAt: 2,
    })
    view.rerender(<OpsxComposeRoute />)

    await waitFor(() => expect(screen.getByText('/stores/next')).toBeInTheDocument())
    expect(screen.getByLabelText('Prompt')).toHaveValue('edited prompt for the operator')
    expect(prepareWorkflowInvocationMock).toHaveBeenCalledTimes(2)
  })

  it.each(['update', 'sync'] as const)(
    'passes the %s action through command-mode workflow preparation',
    async (action) => {
      uiConfigMock.mockReturnValue({
        data: { opsx: { agentInvocationMode: 'command' } },
      })
      useLocationMock.mockReturnValue({
        pathname: '/opsx-compose',
        search: `?action=${action}&change=add-search`,
        hash: '',
        state: null,
      })
      prepareWorkflowInvocationMock.mockResolvedValue({
        kind: 'agent-command',
        text: `/opsx:${action} add-search`,
        mode: { requestedMode: 'command', actualMode: 'command', fallbackReason: null },
        target: WORKFLOW_TARGET,
        evidence: null,
      })

      render(<OpsxComposeRoute />)

      await waitFor(() => {
        expect(prepareWorkflowInvocationMock).toHaveBeenCalledWith({
          requestedMode: 'command',
          workflowInput: { action, changeId: 'add-search' },
          staticFallback: expect.any(Function),
        })
      })
      expect(screen.getByLabelText('Prompt')).toHaveValue(`/opsx:${action} add-search`)
    }
  )
})
