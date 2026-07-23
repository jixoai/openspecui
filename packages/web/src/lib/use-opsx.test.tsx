/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove deferred aggregate OPSX hooks do not start live work before route admission.
 * 2. Prove admission starts exactly one Status and Config subscription and retirement unsubscribes both.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOpsxConfigBundleSubscription, useOpsxStatusListSubscription } from './use-opsx'

const {
  configUnsubscribeMock,
  statusUnsubscribeMock,
  subscribeConfigBundleMock,
  subscribeStatusListMock,
} = vi.hoisted(() => ({
  configUnsubscribeMock: vi.fn(),
  statusUnsubscribeMock: vi.fn(),
  subscribeConfigBundleMock: vi.fn(() => ({ unsubscribe: vi.fn() })),
  subscribeStatusListMock: vi.fn(() => ({ unsubscribe: vi.fn() })),
}))

vi.mock('./static-mode', () => ({ isStaticMode: () => false }))
vi.mock('./trpc', () => ({
  trpcClient: {
    opsx: {
      subscribeConfigBundle: { subscribe: subscribeConfigBundleMock },
      subscribeStatusList: { subscribe: subscribeStatusListMock },
    },
  },
}))

describe('deferred aggregate OPSX subscriptions', () => {
  beforeEach(() => {
    configUnsubscribeMock.mockReset()
    statusUnsubscribeMock.mockReset()
    subscribeConfigBundleMock.mockReset()
    subscribeStatusListMock.mockReset()
    subscribeConfigBundleMock.mockReturnValue({ unsubscribe: configUnsubscribeMock })
    subscribeStatusListMock.mockReturnValue({ unsubscribe: statusUnsubscribeMock })
  })

  it('starts only after admission and retires the admitted subscription generation', () => {
    let enabled = false
    const view = renderHook(() => ({
      config: useOpsxConfigBundleSubscription(enabled),
      statuses: useOpsxStatusListSubscription(enabled),
    }))

    expect(subscribeConfigBundleMock).not.toHaveBeenCalled()
    expect(subscribeStatusListMock).not.toHaveBeenCalled()

    enabled = true
    view.rerender()

    expect(subscribeConfigBundleMock).toHaveBeenCalledOnce()
    expect(subscribeStatusListMock).toHaveBeenCalledOnce()

    enabled = false
    view.rerender()

    expect(configUnsubscribeMock).toHaveBeenCalledOnce()
    expect(statusUnsubscribeMock).toHaveBeenCalledOnce()
  })
})
