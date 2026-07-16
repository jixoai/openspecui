/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify new-change execution remains locked until Root Context succeeds.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxNewRoute } from './opsx-new'

const { createDedicatedSessionMock, prepareWorkflowInvocationMock, rootActionMock, setConfigMock } =
  vi.hoisted(() => ({
    createDedicatedSessionMock: vi.fn(),
    prepareWorkflowInvocationMock: vi.fn(),
    rootActionMock: vi.fn(),
    setConfigMock: vi.fn(),
  }))

vi.mock('@/components/layout/pop-area', () => ({
  usePopAreaConfigContext: () => ({ setConfig: setConfigMock }),
  usePopAreaLifecycleContext: () => ({ requestClose: vi.fn() }),
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: { getAreaForPath: vi.fn(() => 'main') },
}))

vi.mock('@/lib/opsx-workflow-invocation', () => ({
  prepareWorkflowInvocation: prepareWorkflowInvocationMock,
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({ createDedicatedSession: createDedicatedSessionMock }),
}))

vi.mock('@/lib/use-opsx', () => ({
  useOpsxConfigBundleSubscription: () => ({ data: { schemas: [] } }),
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => rootActionMock(),
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  vtNavController: { push: vi.fn() },
}))

describe('OpsxNewRoute', () => {
  beforeEach(() => {
    createDedicatedSessionMock.mockReset()
    prepareWorkflowInvocationMock.mockReset()
    rootActionMock.mockReset().mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 1,
      title: 'Planning root unavailable',
      message: 'Root selection failed.',
      evidence: ['Doctor exit: 1'],
    })
    setConfigMock.mockReset()
  })

  it('does not prepare or create a terminal session while Root Context is blocked', () => {
    render(<OpsxNewRoute />)

    fireEvent.change(screen.getByPlaceholderText('add-search-poparea'), {
      target: { value: 'add-search' },
    })

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Doctor exit: 1')
    expect(prepareWorkflowInvocationMock).not.toHaveBeenCalled()
    expect(createDedicatedSessionMock).not.toHaveBeenCalled()
  })
})
