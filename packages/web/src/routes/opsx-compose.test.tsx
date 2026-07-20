/**
 * Orthogonal intents (updated 2026-07-21 Asia/Shanghai):
 * 1. Verify the change workflow dialog preserves route action and invocation-mode inputs.
 * 2. Verify the shared terminal dispatch surface remains available.
 * 3. Verify server-owned planning-root and Store targets remain visible before dispatch.
 * 4. Verify failed Root Context prevents preparation and every terminal dispatch action.
 * 5. Verify typed draft ownership, pending Root replacement, and public payload-owner recovery.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
import type { RunWorkflowResultV2 } from '@openspecui/core'
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
  addInputHistoryMock,
  assertComposeDraftDispatchableMock,
  prepareWorkflowInvocationMock,
  rootActionMock,
  setConfigMock,
  uiConfigMock,
  useLocationMock,
} = vi.hoisted(() => ({
  addInputHistoryMock: vi.fn(),
  assertComposeDraftDispatchableMock: vi.fn(),
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
    addInputHistory: addInputHistoryMock,
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

vi.mock('@/lib/opsx-compose-draft', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/opsx-compose-draft')>()
  return {
    ...actual,
    assertComposeDraftDispatchable: assertComposeDraftDispatchableMock,
  }
})

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => useLocationMock(),
}))

describe('OpsxComposeRoute', () => {
  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('@/lib/opsx-compose-draft')>(
      '@/lib/opsx-compose-draft'
    )
    addInputHistoryMock.mockReset().mockResolvedValue(undefined)
    assertComposeDraftDispatchableMock
      .mockReset()
      .mockImplementation(actual.assertComposeDraftDispatchable)
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

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(addInputHistoryMock).toHaveBeenCalledWith('edited prompt'))
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
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Use edited prompt for current root' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(addInputHistoryMock).toHaveBeenCalledWith('edited prompt for the operator')
    )
  })

  it('captures pending Root A draft ownership before B preparation resolves and proves the public Save owner guard', async () => {
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
    const readyB = {
      ...readyA,
      context: {
        planningRoot: targetB.planningRoot,
        storeId: targetB.storeId,
        generation: targetB.generation,
        observedAt: 2,
      },
      observedAt: 2,
    }
    const deferred = <T,>() => {
      let resolvePromise: ((value: T) => void) | null = null
      const promise = new Promise<T>((resolve) => {
        resolvePromise = resolve
      })
      return {
        promise,
        resolve(value: T) {
          if (!resolvePromise) throw new Error('Deferred promise resolver is not ready.')
          resolvePromise(value)
        },
      }
    }
    const prepareA = deferred<RunWorkflowResultV2>()
    const prepareB = deferred<RunWorkflowResultV2>()
    prepareWorkflowInvocationMock
      .mockImplementationOnce(() => prepareA.promise)
      .mockImplementationOnce(() => prepareB.promise)
    rootActionMock.mockReturnValue(readyA)

    const view = render(<OpsxComposeRoute />)
    await waitFor(() => expect(prepareWorkflowInvocationMock).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Prompt'), {
      target: { value: 'edited while Root A is pending' },
    })

    rootActionMock.mockReturnValue(readyB)
    view.rerender(<OpsxComposeRoute />)
    await waitFor(() => expect(prepareWorkflowInvocationMock).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('Prompt')).toHaveValue('edited while Root A is pending')

    prepareA.resolve({
      kind: 'agent-prompt',
      text: 'stale Root A prompt',
      format: 'markdown',
      mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
      target: WORKFLOW_TARGET,
      evidence: null,
    })
    prepareB.resolve({
      kind: 'agent-prompt',
      text: 'prepared Root B prompt',
      format: 'markdown',
      mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
      target: targetB,
      evidence: null,
    })

    await waitFor(() => expect(screen.getByText('/stores/next')).toBeInTheDocument())
    expect(screen.getByLabelText('Prompt')).toHaveValue('edited while Root A is pending')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Use edited prompt for current root' })).toBeVisible()

    // Mutation red: retain the B-rendered presentation lock, but remove only the recovery assertion.
    assertComposeDraftDispatchableMock.mockImplementation(() => undefined)
    const mutatedSaveButton = screen.getByRole('button', { name: 'Save' })
    if (!(mutatedSaveButton instanceof HTMLButtonElement) || !mutatedSaveButton.form) {
      throw new Error('Expected Save to submit the public payload-owner form.')
    }
    fireEvent.submit(mutatedSaveButton.form)
    await waitFor(() =>
      expect(addInputHistoryMock).toHaveBeenCalledWith('edited while Root A is pending')
    )

    // Green correction: restore the exact assertion on the same mounted public Save event.
    const actual = await vi.importActual<typeof import('@/lib/opsx-compose-draft')>(
      '@/lib/opsx-compose-draft'
    )
    assertComposeDraftDispatchableMock.mockImplementation(actual.assertComposeDraftDispatchable)
    const correctedSaveButton = screen.getByRole('button', { name: /^Save/ })
    if (!(correctedSaveButton instanceof HTMLButtonElement) || !correctedSaveButton.form) {
      throw new Error('Expected the corrected public Save form.')
    }
    fireEvent.submit(correctedSaveButton.form)
    await waitFor(() =>
      expect(screen.getByText(/prepared for another planning root/)).toBeInTheDocument()
    )
    expect(addInputHistoryMock).toHaveBeenCalledTimes(1)
  })

  it('keeps a dirty draft visible and offers retry when Root B preparation fails', async () => {
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
    const readyB = {
      ...readyA,
      context: {
        ...readyA.context,
        planningRoot: { ...readyA.context.planningRoot, path: '/stores/next', store_id: 'next' },
        storeId: 'next',
        generation: 'planning-next-generation',
        observedAt: 2,
      },
      observedAt: 2,
    }
    const targetB = {
      ...WORKFLOW_TARGET,
      planningRoot: readyB.context.planningRoot,
      storeId: readyB.context.storeId,
      generation: readyB.context.generation,
      observedAt: readyB.context.observedAt,
      rootSelector: { store: 'next' },
    }
    prepareWorkflowInvocationMock
      .mockResolvedValueOnce({
        kind: 'agent-prompt',
        text: 'prepared Root A prompt',
        format: 'markdown',
        mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
        target: WORKFLOW_TARGET,
        evidence: null,
      })
      .mockRejectedValueOnce(new Error('Root B preparation failed'))
      .mockResolvedValueOnce({
        kind: 'agent-prompt',
        text: 'retried Root B prompt',
        format: 'markdown',
        mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
        target: targetB,
        evidence: null,
      })
    rootActionMock.mockReturnValue(readyA)

    const view = render(<OpsxComposeRoute />)
    await waitFor(() =>
      expect(screen.getByLabelText('Prompt')).toHaveValue('prepared Root A prompt')
    )
    fireEvent.change(screen.getByLabelText('Prompt'), {
      target: { value: 'keep this draft after failure' },
    })
    rootActionMock.mockReturnValue(readyB)
    view.rerender(<OpsxComposeRoute />)
    await waitFor(() => expect(screen.getByText('Root B preparation failed')).toBeInTheDocument())
    expect(screen.getByLabelText('Prompt')).toHaveValue('keep this draft after failure')
    expect(screen.getByRole('button', { name: 'Retry preparation' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Retry preparation' }))
    await waitFor(() => expect(screen.getByText('/stores/next')).toBeInTheDocument())
    expect(screen.getByLabelText('Prompt')).toHaveValue('keep this draft after failure')
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
