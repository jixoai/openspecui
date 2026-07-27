/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Render shared loading, empty, error, and stale-data states.
 * 2. Preserve accessible live-region semantics for asynchronous views.
 * 3. Use shared visual lifecycle geometry for first-load states.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 */
import { RealtimeSkeletonInventory } from '@openspecui/web-src/components/realtime/realtime-skeleton'
import { AlertCircle, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DataState } from '../lib/data-state'

/** 统一的首屏加载骨架。视觉只表达几何和光影，文字仅供辅助技术使用。 */
export function LoadingView({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      <span className="rt-sr-status" role="status" aria-live="polite">
        {label}
      </span>
      <RealtimeSkeletonInventory mode="list-divide" count={4} rowClassName="h-14" />
    </div>
  )
}

/** 统一的空态块。 */
export function EmptyView({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 p-8 text-center text-sm">
      <Inbox className="h-6 w-6 opacity-50" aria-hidden />
      <div className="text-foreground font-medium">{title}</div>
      {children ? <div className="max-w-sm">{children}</div> : null}
    </div>
  )
}

/** 统一的错误态块。aria-live=assertive 公告错误，对辅助技术可见。 */
export function ErrorView({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="text-destructive border-destructive/40 bg-destructive/10 flex items-start gap-2 rounded-lg border p-4 text-sm"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{message}</div>
    </div>
  )
}

/**
 * 根据数据状态机渲染统一的骨架分支。
 *
 * 调用方传入 data 状态与「有数据时」的渲染函数；本组件覆盖 loading/empty/error 三种无数据分支。
 * 注意：updating / error-stale 状态由调用方在有数据时自行叠加更新指示器，这里不抢占数据视图。
 */
export function DataStateView<T>({
  state,
  data,
  renderData,
  loadingLabel,
  emptyTitle,
  emptyChildren,
  errorMessage,
}: {
  state: DataState
  data: T | undefined
  renderData: (data: T) => ReactNode
  loadingLabel?: string
  emptyTitle: string
  emptyChildren?: ReactNode
  errorMessage?: string
}) {
  if (state === 'loading' || state === 'idle') {
    return <LoadingView label={loadingLabel} />
  }
  if ((state === 'error' || state === 'error-stale') && data === undefined) {
    return <ErrorView message={errorMessage ?? 'Failed to load data.'} />
  }
  if (data === undefined) {
    return <EmptyView title={emptyTitle}>{emptyChildren}</EmptyView>
  }
  return <>{renderData(data)}</>
}
