/**
 * Orthogonal intents (created 2026-07-20 Asia/Shanghai):
 * 1. Verify tool-delivery subscription rebinds preserve the active generation's authority.
 *
 * Original request (2026-07-20): "The Web subscription must rebind when Environment Global delivery/workflows change."
 * Derived requirement (2026-07-20): replacement input clears prior data, and retired callbacks cannot relabel it.
 */
import type { ToolInitDelivery, ToolInitState } from '@openspecui/core'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToolInitStatesSubscription } from './use-settings-tool-subscriptions'

interface ToolSubscriptionInput {
  delivery: ToolInitDelivery
  workflows: string[]
}

interface ToolSubscriptionCallbacks {
  onData: (data: ToolInitState[]) => void
  onError: (error: Error) => void
}

interface CapturedSubscription {
  input: ToolSubscriptionInput
  callbacks: ToolSubscriptionCallbacks
  unsubscribe: ReturnType<typeof vi.fn<() => void>>
}

interface RenderSnapshot {
  input: ToolSubscriptionInput
  state: ReturnType<typeof useToolInitStatesSubscription>
}

const subscribeMock = vi.hoisted(() =>
  vi.fn<
    (
      input: ToolSubscriptionInput,
      callbacks: ToolSubscriptionCallbacks
    ) => { unsubscribe: () => void }
  >()
)

vi.mock('@/lib/static-mode', () => ({ isStaticMode: () => false }))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    cli: {
      subscribeToolInitStates: { subscribe: subscribeMock },
    },
  },
}))

function toolState(toolId: string, status: ToolInitState['status']): ToolInitState {
  return {
    toolId,
    toolName: toolId,
    status,
    hasAnyArtifacts: status !== 'uninitialized',
    expectedSkillCount: 1,
    presentExpectedSkillCount: status === 'initialized' ? 1 : 0,
    detectedSkillCount: status === 'initialized' ? 1 : 0,
    expectedCommandCount: 0,
    presentExpectedCommandCount: 0,
    detectedCommandCount: 0,
    missingSkillWorkflows: status === 'initialized' ? [] : ['update'],
    missingCommandWorkflows: [],
    unexpectedSkillWorkflows: [],
    unexpectedCommandWorkflows: [],
    legacyCommandWorkflows: [],
  }
}

describe('useToolInitStatesSubscription', () => {
  const subscriptions: CapturedSubscription[] = []

  beforeEach(() => {
    subscriptions.length = 0
    subscribeMock.mockReset().mockImplementation((input, callbacks) => {
      const unsubscribe = vi.fn<() => void>()
      subscriptions.push({ input, callbacks, unsubscribe })
      return { unsubscribe }
    })
  })

  afterEach(() => cleanup())

  it('retires A callbacks when delivery/workflows rebind to B', async () => {
    const inputA: ToolSubscriptionInput = { delivery: 'commands', workflows: ['update'] }
    const inputB: ToolSubscriptionInput = { delivery: 'skills', workflows: ['sync'] }
    const stateA = [toolState('claude-a', 'partial')]
    const staleA = [toolState('claude-a-late', 'initialized')]
    const stateB = [toolState('claude-b', 'initialized')]
    const renderHistory: RenderSnapshot[] = []
    const view = renderHook(
      ({ input }: { input: ToolSubscriptionInput }) => {
        const state = useToolInitStatesSubscription(input)
        renderHistory.push({
          input: { delivery: input.delivery, workflows: [...input.workflows] },
          state,
        })
        return state
      },
      { initialProps: { input: inputA } }
    )

    await waitFor(() => expect(subscriptions).toHaveLength(1))
    expect(subscriptions[0]?.input).toEqual(inputA)
    act(() => subscriptions[0]?.callbacks.onData(stateA))
    await waitFor(() => expect(view.result.current.data).toEqual(stateA))

    const rebindRenderStart = renderHistory.length
    view.rerender({ input: inputB })
    const firstBRender = renderHistory
      .slice(rebindRenderStart)
      .find(
        (snapshot) =>
          snapshot.input.delivery === inputB.delivery &&
          snapshot.input.workflows.join(',') === inputB.workflows.join(',')
      )
    expect(firstBRender?.state).toEqual({ data: undefined, isLoading: true, error: null })
    await waitFor(() => expect(subscriptions).toHaveLength(2))
    expect(subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)
    expect(subscriptions[1]?.input).toEqual(inputB)
    expect(view.result.current.isLoading).toBe(true)
    expect(view.result.current.data).toBeUndefined()

    act(() => subscriptions[0]?.callbacks.onData(staleA))
    expect(view.result.current.isLoading).toBe(true)
    expect(view.result.current.data).not.toEqual(staleA)

    act(() => subscriptions[0]?.callbacks.onError(new Error('retired A failed')))
    expect(view.result.current.isLoading).toBe(true)
    expect(view.result.current.error).toBeNull()

    act(() => subscriptions[1]?.callbacks.onData(stateB))
    await waitFor(() => {
      expect(view.result.current.isLoading).toBe(false)
      expect(view.result.current.data).toEqual(stateB)
      expect(view.result.current.error).toBeNull()
    })

    act(() => {
      subscriptions[0]?.callbacks.onData(staleA)
      subscriptions[0]?.callbacks.onError(new Error('retired A failed after B'))
    })
    expect(view.result.current.isLoading).toBe(false)
    expect(view.result.current.data).toEqual(stateB)
    expect(view.result.current.error).toBeNull()
  })
})
