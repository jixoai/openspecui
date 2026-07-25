/**
 * Orthogonal intents (created 2026-07-25 Asia/Shanghai):
 * 1. Define the typed mocked tRPC callback boundary used by Dashboard Summary v2 tests.
 * 2. Keep public wake-shape evidence inside the normal checked Web source lane.
 *
 * Original request (2026-07-23): "在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
 */
import type { DashboardSummaryInvalidation } from '@openspecui/core/dashboard-summary-transport'

/** Mocked tRPC subscriber shape for the Summary-only v2 transport fixture. */
export interface DashboardSummaryMockSubscriber {
  onData: (event: DashboardSummaryInvalidation) => void
  onError(error: Error): void
}

type IsExact<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false

type Assert<Type extends true> = Type

/** Fails the regular Web typecheck if this fixture erases the public Summary wake type. */
export type DashboardSummaryMockSubscriberContract = Assert<
  IsExact<Parameters<DashboardSummaryMockSubscriber['onData']>[0], DashboardSummaryInvalidation>
>
