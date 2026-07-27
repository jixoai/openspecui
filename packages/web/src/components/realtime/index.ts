/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Barrel the composable realtime visual atoms for route/overlay consumption.
 * 2. Load the realtime lifecycle CSS (shape, luminance, native motion, reduced-motion).
 *
 * Original request (2026-07-23): "一次性把现有的页面都统一整改……统一组件的封装和开发。"
 */
import '@/styles/realtime.css'

export { AsyncAction, type AsyncActionProps } from './async-action'
export { RealtimeRevalidateCue, RealtimeSettle } from './realtime-cue'
export {
  RealtimeAccessibleStatus,
  RealtimeEmpty,
  RealtimeError,
  type RealtimeAccessibleStatusProps,
  type RealtimeEmptyProps,
  type RealtimeErrorProps,
} from './realtime-primitives'
export { RealtimeProgress, type RealtimeProgressProps } from './realtime-progress'
export {
  RealtimeProjectionRoot,
  useRealtimeProjection,
  type RealtimeProjectionRootProps,
} from './realtime-projection'
export {
  RealtimeSkeleton,
  RealtimeSkeletonCard,
  RealtimeSkeletonInventory,
  RealtimeSkeletonLine,
  RealtimeSkeletonRow,
  type RealtimeSkeletonInventoryProps,
  type RealtimeSkeletonMode,
  type RealtimeSkeletonProps,
} from './realtime-skeleton'
export {
  ArchiveListSkeleton,
  ChangeListSkeleton,
  ConfigFormSkeleton,
  DashboardSummarySkeleton,
  DashboardTrendsSkeleton,
  DetailPanelSkeleton,
  GitWorktreeSkeleton,
  RoutePendingSkeleton,
  SpecListSkeleton,
} from './route-skeletons'
