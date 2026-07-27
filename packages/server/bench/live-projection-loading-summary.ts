/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Validate that a Dashboard Summary wake and its Server pull describe one exact work instance.
 * 2. Keep benchmark-specific pair rejection separate from Dashboard production transport ownership.
 *
 * Original request (2026-07-23): "在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
 * Original request (2026-07-27): "Dashboard页面每次页面刷新的时候，它仍然要加载很多？"
 */
import type {
  DashboardSummaryInvalidation,
  DashboardSummaryProjectionState,
} from '@openspecui/core'

/** Reject a wake/read pair unless the Server-owned identity and work generation match exactly. */
export function assertMatchingDashboardSummaryState(
  wake: DashboardSummaryInvalidation,
  state: DashboardSummaryProjectionState
): void {
  if (wake.identity !== state.identity) {
    throw new Error('Dashboard Summary identity mismatch between wake and pull.')
  }
  if (wake.workGeneration !== state.workGeneration) {
    throw new Error('Dashboard Summary generation mismatch between wake and pull.')
  }
}
