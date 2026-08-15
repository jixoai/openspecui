/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Prove Agent Integrations starts with Pull and accepts retained replacement Push snapshots.
 * 2. Prove explicit refresh replaces readable data and component disposal releases subscription ownership.
 *
 * Original request (2026-08-01): consume the Server-owned Agent projection without browser policy inputs.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getMock, refreshMock, subscribeMock, unsubscribeMock, setSubscribeHandlers } = vi.hoisted(
  () => {
    let handlers: { onData(data: unknown): void; onError(error: unknown): void } | null = null
    return {
      getMock: vi.fn(),
      refreshMock: vi.fn(),
      subscribeMock: vi.fn(
        (
          _input: undefined,
          nextHandlers: { onData(data: unknown): void; onError(error: unknown): void }
        ) => {
          handlers = nextHandlers
          return { unsubscribe: unsubscribeMock }
        }
      ),
      unsubscribeMock: vi.fn(),
      setSubscribeHandlers: () => handlers,
    }
  }
)

vi.mock('./trpc', () => ({
  trpcClient: {
    agentIntegrations: {
      get: { query: getMock },
      refresh: { query: refreshMock },
      subscribe: { subscribe: subscribeMock },
    },
  },
}))

import type { AgentIntegrationsProjection } from './use-agent-integrations'
import { useAgentIntegrations } from './use-agent-integrations'

function createProjection(profile: 'core' | 'custom'): AgentIntegrationsProjection {
  return {
    registry: [
      {
        name: 'Codex',
        value: 'codex',
        available: true,
        skillsDir: '.agents',
        legacySkillsDirs: ['.codex'],
        capability: 'skills-invocable',
        command: null,
      },
    ],
    policy: {
      profile,
      delivery: 'skills',
      workflows: ['apply'],
    },
    states: [
      {
        toolId: 'codex',
        toolName: 'Codex',
        status: 'initialized',
        readiness: 'initialized',
        issues: [],
        hasAnyArtifacts: true,
        skillsScope: { kind: 'project', skillsDir: '.agents' },
        legacySkillRoots: ['.codex'],
        requiresIdeRestart: false,
        commandSurfaceUnavailableReason: null,
        expectedSkillCount: 1,
        presentExpectedSkillCount: 1,
        detectedSkillCount: 1,
        expectedCommandCount: 0,
        presentExpectedCommandCount: 0,
        detectedCommandCount: 0,
        missingSkillWorkflows: [],
        missingCommandWorkflows: [],
        unexpectedSkillWorkflows: [],
        unexpectedCommandWorkflows: [],
        legacyCommandWorkflows: [],
        installedSkillWorkflows: ['apply'],
        installedCommandWorkflows: [],
        generatedByVersion: '1.7.0',
      },
    ],
  }
}

describe('useAgentIntegrations', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue(createProjection('core'))
    refreshMock.mockReset().mockResolvedValue(createProjection('custom'))
    subscribeMock.mockClear()
    unsubscribeMock.mockClear()
  })

  afterEach(() => cleanup())

  it('combines Pull, retained replacement Push, refresh, and disposal', async () => {
    const { result, unmount } = renderHook(() => useAgentIntegrations())

    await waitFor(() => expect(result.current.data?.policy.profile).toBe('core'))

    act(() => {
      setSubscribeHandlers()?.onData(createProjection('custom'))
    })
    expect(result.current.data?.policy.profile).toBe('custom')

    await act(async () => {
      await result.current.refresh()
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(result.current.isRefreshing).toBe(false)

    unmount()
    expect(unsubscribeMock).toHaveBeenCalledTimes(1)
  })

  it('retains a subscription failure when the initial Pull later succeeds', async () => {
    let resolvePull: (projection: AgentIntegrationsProjection) => void = () => {}
    getMock.mockReturnValueOnce(
      new Promise<AgentIntegrationsProjection>((resolve) => {
        resolvePull = resolve
      })
    )
    const { result } = renderHook(() => useAgentIntegrations())

    act(() => {
      setSubscribeHandlers()?.onError(new Error('Agent stream disconnected'))
    })
    expect(result.current.error?.message).toBe('Agent stream disconnected')

    await act(async () => {
      resolvePull(createProjection('core'))
      await Promise.resolve()
    })

    expect(result.current.data?.policy.profile).toBe('core')
    expect(result.current.error?.message).toBe('Agent stream disconnected')
    expect(result.current.isLoading).toBe(false)
  })
})
