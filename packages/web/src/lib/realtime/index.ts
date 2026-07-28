/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Barrel the realtime projection state-law + adapters for route/overlay consumption.
 *
 * Original request (2026-07-23): "一次性把现有的页面都统一整改……全部改动，才能在中途暴露出所有隐含的可能、状态。"
 */
export {
  deriveProjectionState,
  type RealtimeProjectionAuthority,
  type RealtimeProjectionCause,
  type RealtimeProjectionEmptyPredicate,
  type RealtimeProjectionInput,
  type RealtimeProjectionProgress,
  type RealtimeProjectionState,
  type RealtimeProjectionTopology,
} from './state'

export {
  authorityReasonToCause,
  deriveAuthority,
  fromAuthoritativeState,
  fromChangesState,
  fromQueryState,
  fromReactiveProjectionState,
  fromSubscriptionState,
} from './adapters'
