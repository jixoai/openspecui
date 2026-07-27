/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove deferred aggregate OPSX hooks do not start Planning CLI Projection work before route admission.
 * 2. Prove admission uses selector-exact lifecycle subscriptions and retirement unsubscribes both generations.
 * 3. Prove Change enumeration uses the generic CLI lifecycle instead of a full-payload OPSX stream.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-26): "旧测试仍 mock 已删除订阅。请按真实类型/合同迁移测试。"
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
      refresh: { mutate: projectionRefreshMock },
      subscribe: { subscribe: projectionSubscribeMock },
    },
  },
}))

describe('deferred aggregate OPSX projections', () => {
  beforeEach(() => {
    configUnsubscribeMock.mockReset()
    projectionReadMock.mockReset()
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
    expect(projectionReadMock).not.toHaveBeenCalled()

    enabled = true
    view.rerender()

    await waitFor(() => expect(projectionSubscribeMock).toHaveBeenCalledTimes(3))
    expect(projectionSubscribeMock.mock.calls.map(([selector]) => selector)).toEqual([
      { kind: 'opsx-change-list' },
      { kind: 'opsx-config-bundle' },
      { kind: 'opsx-status-list' },
    ])
    expect(projectionReadMock).not.toHaveBeenCalled()

    enabled = false
    view.rerender()

    expect(configUnsubscribeMock).toHaveBeenCalledOnce()
    expect(statusUnsubscribeMock).toHaveBeenCalledOnce()

    view.unmount()
    expect(listUnsubscribeMock).toHaveBeenCalledOnce()
  })
})
