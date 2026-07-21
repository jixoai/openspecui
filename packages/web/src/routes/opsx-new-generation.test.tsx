/**
 * Orthogonal intents (created 2026-07-21 Asia/Shanghai):
 * 1. Prove the mounted New form rechecks prepared generation immediately before terminal creation.
 * 2. Prove observedAt-only refresh preserves same-generation form dispatch.
 *
 * Original request (2026-07-21): "New：只证明真实 form submit 的精确 dispatch guard。"
 * Owner correction (2026-07-21): "每项先明确一个生产 owner、一个精准红例、一个绿例。"
 */
import type { WorkflowInvocationTargetV2 } from '@openspecui/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxNewRoute } from './opsx-new'

const ROOT_A_TARGET = {
  launchProject: { path: '/launch' },
  planningRoot: { path: '/planning-a', source: 'nearest', healthy: true, status: [] },
  storeId: null,
  observedAt: 1,
  generation: 'planning-a-generation',
  rootSelector: {},
  references: [],
  diagnostics: { root: [], doctor: [], context: [] },
  rootEvidence: { doctor: null, context: null },
} satisfies WorkflowInvocationTargetV2

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

vi.mock('@/lib/opsx-workflow-invocation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/opsx-workflow-invocation')>()
  return {
    ...actual,
    prepareWorkflowInvocation: prepareWorkflowInvocationMock,
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

function readyRoot(observedAt: number, generation = ROOT_A_TARGET.generation) {
  return {
    status: 'ready' as const,
    disabled: false,
    context: {
      planningRoot: ROOT_A_TARGET.planningRoot,
      storeId: ROOT_A_TARGET.storeId,
      observedAt,
      generation,
    },
    observedAt,
    title: null,
    message: null,
    evidence: [],
  }
}

function prepareRootACommand() {
  return {
    kind: 'cli-command' as const,
    command: 'openspec',
    args: ['new', 'change', 'add-search'],
    mode: { requestedMode: 'direct' as const, actualMode: 'direct' as const, fallbackReason: null },
    target: ROOT_A_TARGET,
    evidence: null,
  }
}

function getMountedForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector('form')
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Expected the New route form to remain mounted.')
  }
  return form
}

async function prepareCommand(view: ReturnType<typeof render>): Promise<void> {
  fireEvent.change(screen.getByPlaceholderText('add-search-poparea'), {
    target: { value: 'add-search' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create' }))
  await waitFor(() => expect(screen.getByText('/planning-a')).toBeInTheDocument())
  expect(createDedicatedSessionMock).not.toHaveBeenCalled()
  expect(getMountedForm(view.container)).toBeInTheDocument()
}

describe('OpsxNewRoute generation owner', () => {
  beforeEach(() => {
    createDedicatedSessionMock.mockReset()
    prepareWorkflowInvocationMock.mockReset().mockResolvedValue(prepareRootACommand())
    rootActionMock.mockReset().mockReturnValue(readyRoot(1))
    setConfigMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('rejects stale Root A through the real form owner after Root B replaces its generation', async () => {
    const view = render(<OpsxNewRoute />)
    await prepareCommand(view)

    rootActionMock.mockReturnValue(readyRoot(2, 'planning-b-generation'))
    view.rerender(<OpsxNewRoute />)
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()

    fireEvent.submit(getMountedForm(view.container))

    // Removing only the inline owner guard must expose this exact A command/generation call.
    expect(createDedicatedSessionMock).not.toHaveBeenCalledWith(
      'openspec',
      ['new', 'change', 'add-search'],
      expect.objectContaining({
        cwdTarget: 'planning-root',
        expectedRootGeneration: 'planning-a-generation',
      })
    )
    await waitFor(() =>
      expect(
        screen.getByText('Planning root changed before dispatch. Prepare this workflow again.')
      ).toBeInTheDocument()
    )
    expect(createDedicatedSessionMock).not.toHaveBeenCalled()
  })

  it('dispatches the prepared command after an observedAt-only Root refresh', async () => {
    const view = render(<OpsxNewRoute />)
    await prepareCommand(view)

    rootActionMock.mockReturnValue(readyRoot(2))
    view.rerender(<OpsxNewRoute />)
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()

    fireEvent.submit(getMountedForm(view.container))

    await waitFor(() => expect(createDedicatedSessionMock).toHaveBeenCalledTimes(1))
    expect(createDedicatedSessionMock).toHaveBeenCalledWith(
      'openspec',
      ['new', 'change', 'add-search'],
      expect.objectContaining({
        cwdTarget: 'planning-root',
        expectedRootGeneration: 'planning-a-generation',
      })
    )
  })
})
