/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Verify change validation dialog lifecycle.
 * 2. Verify Root Context failure prevents command preparation and execution.
 * 3. Verify direct validation preserves typed diagnostics and raw evidence on demand.
 * 4. Verify prepared Root A validation is rejected after Root B replacement.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Original request (2026-07-17): "CliStreamTransport is the single execution and display truth."
 * Original request (2026-07-28): supporting workflow evidence should remain available on demand.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxVerifyRoute } from './opsx-verify'

const {
  commandsMock,
  prepareWorkflowInvocationMock,
  replaceAllMock,
  rootActionMock,
  runAllMock,
  setConfigMock,
  useLocationMock,
  workflowDiagnosticsMock,
} = vi.hoisted(() => {
  const replaceAllMock = vi.fn()
  const runAllMock = vi.fn()
  return {
    commandsMock: { replaceAll: replaceAllMock, runAll: runAllMock },
    prepareWorkflowInvocationMock: vi.fn(),
    replaceAllMock,
    rootActionMock: vi.fn(),
    runAllMock,
    setConfigMock: vi.fn(),
    useLocationMock: vi.fn(),
    workflowDiagnosticsMock: vi.fn(),
  }
})

vi.mock('@/components/layout/pop-area', () => ({
  usePopAreaConfigContext: () => ({
    setConfig: setConfigMock,
  }),
  usePopAreaLifecycleContext: () => ({
    requestClose: vi.fn(),
  }),
}))

vi.mock('@/lib/use-cli-runner', () => ({
  useCliRunner: () => ({
    lines: [],
    status: 'idle',
    hasStarted: false,
    commands: commandsMock,
    reset: vi.fn(),
    cancel: vi.fn(),
  }),
}))

vi.mock('@/lib/opsx-workflow-invocation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/opsx-workflow-invocation')>()
  return {
    ...actual,
    prepareWorkflowInvocation: prepareWorkflowInvocationMock,
    workflowDiagnosticsToText: workflowDiagnosticsMock,
  }
})

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => rootActionMock(),
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => useLocationMock(),
}))

describe('OpsxVerifyRoute', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    prepareWorkflowInvocationMock.mockReset().mockResolvedValue({
      kind: 'cli-command',
      command: 'openspec',
      args: ['validate', 'add-terminal-spawn-command', '--type', 'change', '--strict'],
      mode: { requestedMode: 'direct', actualMode: 'direct', fallbackReason: null },
      target: null,
      evidence: null,
    })
    replaceAllMock.mockReset()
    runAllMock.mockReset()
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
    useLocationMock.mockReturnValue({
      pathname: '/opsx-verify',
      search: '?change=add-terminal-spawn-command',
      hash: '',
      state: null,
    })
    workflowDiagnosticsMock.mockReset().mockReturnValue(null)
  })

  it('blocks outside dismiss for change detail verify workflow dialogs', () => {
    render(<OpsxVerifyRoute />)

    expect(setConfigMock).toHaveBeenCalledWith(expect.objectContaining({ onDismissRequest: null }))
  })

  it('does not prepare or run validation while Root Context is blocked', async () => {
    rootActionMock.mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Planning root unavailable',
      message: 'Root selection failed.',
      evidence: ['Context exit: 1'],
    })

    render(<OpsxVerifyRoute />)

    expect(await screen.findByText('Root selection failed.')).toBeVisible()
    expect(screen.getByText('Context exit: 1')).not.toBeVisible()
    expect(prepareWorkflowInvocationMock).not.toHaveBeenCalled()
    expect(replaceAllMock).not.toHaveBeenCalled()
    expect(runAllMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Re-run' })).toBeDisabled()
  })

  it('runs strict validation and renders preserved preparation diagnostics', async () => {
    workflowDiagnosticsMock.mockReturnValue(
      'ERROR specs/auth/spec.md: MODIFIED requirement would remove existing scenarios.'
    )

    render(<OpsxVerifyRoute />)

    await waitFor(() => {
      expect(prepareWorkflowInvocationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedMode: 'direct',
          workflowInput: {
            action: 'verify',
            changeId: 'add-terminal-spawn-command',
            strict: true,
          },
        })
      )
    })
    expect(replaceAllMock).toHaveBeenCalledWith([
      {
        type: 'validate',
        input: {
          id: 'add-terminal-spawn-command',
          type: 'change',
          strict: true,
        },
        displayArgs: ['validate', 'add-terminal-spawn-command', '--type', 'change', '--strict'],
      },
    ])
    expect(screen.getByText(/MODIFIED requirement would remove existing scenarios/)).toBeTruthy()
  })

  it('keeps the complete preparation evidence collapsed until requested', async () => {
    prepareWorkflowInvocationMock.mockResolvedValue({
      kind: 'cli-command',
      command: 'openspec',
      args: ['validate', 'add-terminal-spawn-command', '--type', 'change', '--strict'],
      mode: { requestedMode: 'direct', actualMode: 'direct', fallbackReason: null },
      target: null,
      evidence: {
        kind: 'workflow-status',
        options: {},
        result: {
          success: true,
          stdout: '{"changeName":"add-terminal-spawn-command"}',
          stderr: '',
          exitCode: 0,
          data: { changeName: 'add-terminal-spawn-command' },
          payload: { changeName: 'add-terminal-spawn-command' },
          diagnostics: [],
          contractError: null,
        },
      },
    })

    render(<OpsxVerifyRoute />)

    const trigger = await screen.findByRole('button', { name: /CLI evidence/ })
    const rawEvidence = screen.getByText(
      (_, element) =>
        element?.tagName === 'PRE' &&
        element.textContent?.includes('"changeName": "add-terminal-spawn-command"') === true
    )
    expect(rawEvidence).not.toBeVisible()
    fireEvent.click(trigger)
    expect(rawEvidence).toBeVisible()
    expect(screen.getByText(/Running validation for/)).toBeVisible()
  })

  it('rejects the prepared A target at the runner boundary after Root B replaces it', async () => {
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
      kind: 'cli-command',
      command: 'openspec',
      args: ['validate', 'add-terminal-spawn-command', '--type', 'change', '--strict'],
      mode: { requestedMode: 'direct', actualMode: 'direct', fallbackReason: null },
      target,
      evidence: null,
    })
    let view: ReturnType<typeof render>
    replaceAllMock.mockImplementation(() => {
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
      view.rerender(<OpsxVerifyRoute />)
    })

    view = render(<OpsxVerifyRoute />)
    await waitFor(() => expect(replaceAllMock).toHaveBeenCalled())
    expect(runAllMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Re-run' })).toBeDisabled()
  })
})
