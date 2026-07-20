/**
 * Orthogonal intents (updated 2026-07-20 Asia/Shanghai):
 * 1. Verify new-change execution remains locked until Root Context succeeds.
 * 2. Verify prepared planning-root targets render before terminal creation.
 * 3. Verify Root A to B replacement locks stale Create dispatch.
 * 4. Verify Store selector arguments shown in the prepared command are the dispatched arguments.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxNewRoute } from './opsx-new'

const {
  createDedicatedSessionMock,
  prepareWorkflowInvocationMock,
  rootActionMock,
  setConfigMock,
  workflowTargetGuardMock,
} = vi.hoisted(() => ({
  createDedicatedSessionMock: vi.fn(),
  prepareWorkflowInvocationMock: vi.fn(),
  rootActionMock: vi.fn(),
  setConfigMock: vi.fn(),
  workflowTargetGuardMock: vi.fn(),
}))

vi.mock('@/components/layout/pop-area', () => ({
  usePopAreaConfigContext: () => ({ setConfig: setConfigMock }),
  usePopAreaLifecycleContext: () => ({ requestClose: vi.fn() }),
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: { getAreaForPath: vi.fn(() => 'main') },
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
  }
})

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
  afterEach(() => {
    cleanup()
  })

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('@/lib/opsx-workflow-invocation')>(
      '@/lib/opsx-workflow-invocation'
    )
    createDedicatedSessionMock.mockReset()
    prepareWorkflowInvocationMock.mockReset()
    workflowTargetGuardMock.mockReset().mockImplementation(actual.isWorkflowTargetCurrent)
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

  it('locks an A command after same-path Root B replaces its generation', async () => {
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
        generation: 'planning-a-generation',
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
      args: ['new', 'change', 'add-search'],
      mode: { requestedMode: 'direct', actualMode: 'direct', fallbackReason: null },
      target,
      evidence: null,
    })

    const view = render(<OpsxNewRoute />)
    fireEvent.change(screen.getByPlaceholderText('add-search-poparea'), {
      target: { value: 'add-search' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(screen.getByText('/planning-a')).toBeInTheDocument())
    expect(createDedicatedSessionMock).not.toHaveBeenCalled()

    rootActionMock.mockReturnValue({
      ...readyA,
      context: {
        planningRoot: target.planningRoot,
        storeId: null,
        observedAt: 2,
        generation: 'planning-b-generation',
      },
      observedAt: 2,
    })
    view.rerender(<OpsxNewRoute />)

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(createDedicatedSessionMock).not.toHaveBeenCalled()
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
      kind: 'cli-command',
      command: 'openspec',
      args: ['new', 'change', 'add-search'],
      mode: { requestedMode: 'direct', actualMode: 'direct', fallbackReason: null },
      target,
      evidence: null,
    })

    const view = render(<OpsxNewRoute />)
    fireEvent.change(screen.getByPlaceholderText('add-search-poparea'), {
      target: { value: 'add-search' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
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
    view.rerender(<OpsxNewRoute />)
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(createDedicatedSessionMock).toHaveBeenCalledTimes(1))
    expect(createDedicatedSessionMock).toHaveBeenCalledWith(
      'openspec',
      ['new', 'change', 'add-search'],
      expect.objectContaining({
        cwdTarget: 'planning-root',
        expectedRootGeneration: 'planning-a-generation',
      })
    )

    // Green evidence: restore the production helper without rerendering; the same public submit
    // closure must reject Root A before createDedicatedSession.
    const actual = await vi.importActual<typeof import('@/lib/opsx-workflow-invocation')>(
      '@/lib/opsx-workflow-invocation'
    )
    workflowTargetGuardMock.mockImplementation(actual.isWorkflowTargetCurrent)
    const form = view.container.querySelector('form')
    expect(form).not.toBeNull()
    if (!form) throw new Error('Expected the New route form to remain mounted.')
    fireEvent.submit(form)
    await waitFor(() =>
      expect(
        screen.getByText('Planning root changed before dispatch. Prepare this workflow again.')
      ).toBeInTheDocument()
    )
    expect(createDedicatedSessionMock).toHaveBeenCalledTimes(1)
  })

  it('renders and dispatches the Server-prepared Store selector command', async () => {
    const target = {
      launchProject: { path: '/launch' },
      planningRoot: { path: '/planning-store', source: 'store', healthy: true, status: [] },
      storeId: 'shared',
      observedAt: 1,
      generation: 'planning-store-generation',
      rootSelector: { store: 'shared' },
      references: [],
      diagnostics: { root: [], doctor: [], context: [] },
      rootEvidence: { doctor: null, context: null },
    }
    rootActionMock.mockReturnValue({
      status: 'ready',
      disabled: false,
      context: {
        planningRoot: target.planningRoot,
        storeId: 'shared',
        observedAt: 1,
        generation: target.generation,
      },
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    })
    prepareWorkflowInvocationMock.mockResolvedValue({
      kind: 'cli-command',
      command: 'openspec',
      args: ['new', 'change', 'add-store', '--store', 'shared'],
      mode: { requestedMode: 'direct', actualMode: 'direct', fallbackReason: null },
      target,
      evidence: null,
    })

    render(<OpsxNewRoute />)
    fireEvent.change(screen.getByPlaceholderText('add-search-poparea'), {
      target: { value: 'add-store' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(screen.getByText('openspec new change add-store --store shared')).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(createDedicatedSessionMock).toHaveBeenCalledTimes(1))
    expect(createDedicatedSessionMock).toHaveBeenCalledWith(
      'openspec',
      ['new', 'change', 'add-store', '--store', 'shared'],
      expect.objectContaining({
        cwdTarget: 'planning-root',
        expectedRootGeneration: 'planning-store-generation',
      })
    )
  })
})
