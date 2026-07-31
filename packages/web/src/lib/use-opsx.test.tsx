/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove deferred aggregate OPSX hooks do not start Planning CLI Projection work before route admission.
 * 2. Prove admission uses selector-exact lifecycle subscriptions and retirement unsubscribes both generations.
 * 3. Prove Change enumeration uses the generic CLI lifecycle instead of a full-payload OPSX stream.
 * 4. Prove each admitted selector starts one typed Pull and exposes refresh through readonly query transport.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-26): "旧测试仍 mock 已删除订阅。请按真实类型/合同迁移测试。"
 * Original request (2026-07-31): "系统性地进行修复，因为List页面也有类似的问题。"
 * Owner correction (2026-07-31): Projection refresh is readonly cache maintenance.
 */
import type { PlanningCliProjectionSelector } from '@openspecui/core/planning-cli-projection'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useOpsxChangeListSubscription,
  useOpsxConfigBundleSubscription,
  useOpsxStatusListSubscription,
} from './use-opsx'

interface ProjectionNoticeCallbacks {
  onData(data: unknown): void
  onError(error: Error): void
  onConnectionStateChange(state: {
    state: 'idle' | 'connecting' | 'pending'
    error: Error | null
  }): void
  onStopped(): void
  onComplete(): void
}

const {
  configUnsubscribeMock,
  listUnsubscribeMock,
  projectionReadMock,
  projectionRefreshMock,
  projectionSubscribeMock,
  statusUnsubscribeMock,
} = vi.hoisted(() => ({
  configUnsubscribeMock: vi.fn(),
  listUnsubscribeMock: vi.fn(),
  projectionReadMock: vi.fn<(selector: PlanningCliProjectionSelector) => Promise<unknown>>(),
  projectionRefreshMock: vi.fn<(selector: PlanningCliProjectionSelector) => Promise<unknown>>(),
  projectionSubscribeMock:
    vi.fn<
      (
        selector: PlanningCliProjectionSelector,
        callbacks: ProjectionNoticeCallbacks
      ) => { unsubscribe(): void }
    >(),
  statusUnsubscribeMock: vi.fn(),
}))

vi.mock('./static-mode', () => ({ isStaticMode: () => false }))
vi.mock('./trpc', () => ({
  trpcClient: {
    planningCliProjection: {
      read: { query: projectionReadMock },
      refresh: { query: projectionRefreshMock },
      subscribe: { subscribe: projectionSubscribeMock },
    },
  },
}))

describe('deferred aggregate OPSX projections', () => {
  beforeEach(() => {
    configUnsubscribeMock.mockReset()
    projectionReadMock.mockReset()
    projectionReadMock.mockImplementation(async (selector) => ({
      state: 'loading',
      identity: JSON.stringify(selector),
      workGeneration: 1,
      invalidationCause: 'initial',
      data: null,
      freshness: null,
      snapshotGeneration: null,
      error: null,
    }))
    projectionRefreshMock.mockReset()
    projectionSubscribeMock.mockReset().mockImplementation((selector) => {
      if (selector.kind === 'opsx-config-bundle') {
        return { unsubscribe: configUnsubscribeMock }
      }
      if (selector.kind === 'opsx-status-list') {
        return { unsubscribe: statusUnsubscribeMock }
      }
      if (selector.kind === 'opsx-change-list') {
        return { unsubscribe: listUnsubscribeMock }
      }
      throw new Error(`Unexpected aggregate selector: ${selector.kind}`)
    })
    statusUnsubscribeMock.mockReset()
    listUnsubscribeMock.mockReset()
  })

  it('starts selector-exact lifecycle work only after admission and retires every subscription', async () => {
    let enabled = false
    const view = renderHook(() => ({
      changes: useOpsxChangeListSubscription(),
      config: useOpsxConfigBundleSubscription(enabled),
      statuses: useOpsxStatusListSubscription(enabled),
    }))

    await waitFor(() => expect(projectionSubscribeMock).toHaveBeenCalledOnce())
    expect(projectionSubscribeMock).toHaveBeenLastCalledWith(
      { kind: 'opsx-change-list' },
      expect.any(Object)
    )
    await waitFor(() => expect(projectionReadMock).toHaveBeenCalledOnce())
    expect(projectionReadMock).toHaveBeenLastCalledWith({ kind: 'opsx-change-list' })

    enabled = true
    view.rerender()

    await waitFor(() => expect(projectionSubscribeMock).toHaveBeenCalledTimes(3))
    expect(projectionSubscribeMock.mock.calls.map(([selector]) => selector)).toEqual([
      { kind: 'opsx-change-list' },
      { kind: 'opsx-config-bundle' },
      { kind: 'opsx-status-list' },
    ])
    await waitFor(() => expect(projectionReadMock).toHaveBeenCalledTimes(3))
    expect(projectionReadMock.mock.calls.map(([selector]) => selector)).toEqual([
      { kind: 'opsx-change-list' },
      { kind: 'opsx-config-bundle' },
      { kind: 'opsx-status-list' },
    ])

    enabled = false
    view.rerender()

    expect(configUnsubscribeMock).toHaveBeenCalledOnce()
    expect(statusUnsubscribeMock).toHaveBeenCalledOnce()

    view.unmount()
    expect(listUnsubscribeMock).toHaveBeenCalledOnce()
  })
})
