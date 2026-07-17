/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Verify change validation dialog lifecycle.
 * 2. Verify Root Context failure prevents command preparation and execution.
 * 3. Verify direct validation queues only its typed transport and preserves diagnostics.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Original request (2026-07-17): "CliStreamTransport is the single execution and display truth."
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxVerifyRoute } from './opsx-verify'

const {
  prepareWorkflowInvocationMock,
  replaceAllMock,
  rootActionMock,
  runAllMock,
  setConfigMock,
  useLocationMock,
  workflowDiagnosticsMock,
} = vi.hoisted(() => ({
  prepareWorkflowInvocationMock: vi.fn(),
  replaceAllMock: vi.fn(),
  rootActionMock: vi.fn(),
  runAllMock: vi.fn(),
  setConfigMock: vi.fn(),
  useLocationMock: vi.fn(),
  workflowDiagnosticsMock: vi.fn(),
}))

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
    commands: {
      replaceAll: replaceAllMock,
      runAll: runAllMock,
    },
    reset: vi.fn(),
    cancel: vi.fn(),
  }),
}))

vi.mock('@/lib/opsx-workflow-invocation', () => ({
  prepareWorkflowInvocation: prepareWorkflowInvocationMock,
  workflowDiagnosticsToText: workflowDiagnosticsMock,
}))

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

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Context exit: 1')
    })
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
      },
    ])
    expect(screen.getByText(/MODIFIED requirement would remove existing scenarios/)).toBeTruthy()
  })
})
