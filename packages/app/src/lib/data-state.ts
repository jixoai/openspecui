/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Derive one exhaustive data lifecycle for empty and stale-data projections.
 * 2. Expose reusable pending and renderable-state predicates.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 */
/**
 * 统一的 8-拓扑数据状态机（Style 指令：全生命周期状态机）。
 *
 * 任何触发网络请求的视图都用这套状态推导渲染分支，杜绝幽灵操作与等待焦虑。
 * 状态语义：
 *  - idle:         尚未发起首次请求（无数据、未加载）
 *  - loading:      首次加载中（无数据、加载中）
 *  - loaded:       有数据、已加载（稳定）
 *  - updating:     有数据、后台更新中（有数据、更新中）
 *  - error:        无数据 + 请求失败（无数据、异常）
 *  - error-stale:  有旧数据 + 更新失败（有数据、异常）
 *
 * 注意：本轮骨架阶段后端未就绪，所有数据源返回 undefined；视图据此渲染 loading/empty 骨架。
 */
export type DataState = 'idle' | 'loading' | 'loaded' | 'updating' | 'error' | 'error-stale'

/** Inputs used to derive the complete data rendering lifecycle. */
export interface DataStateInput<T> {
  /** 当前数据（可能 undefined）。 */
  data: T | undefined
  /** 是否有进行中的请求。 */
  isLoading: boolean
  /** 是否已发起过请求（首次之后）。 */
  hasFetched: boolean
  /** 最近一次请求错误。 */
  error: Error | null
}

/**
 * 把 (data, isLoading, hasFetched, error) 归约成 6 个渲染友好的状态。
 *
 * 复合了「有无数据」与「请求/异常」两个维度，覆盖 Style 指令的全生命周期拓扑。
 */
export function deriveDataState<T>(input: DataStateInput<T>): DataState {
  const { data, isLoading, hasFetched, error } = input
  const hasData = data !== undefined

  if (error && !hasData) return 'error'
  if (error && hasData) return 'error-stale'

  if (isLoading && !hasData) return hasFetched ? 'loading' : 'loading'
  if (isLoading && hasData) return 'updating'

  if (hasData) return 'loaded'
  return hasFetched ? 'idle' : 'idle'
}

/** 判断当前状态是否应展示数据视图（有数据时即使 updating/error-stale 也展示数据）。 */
export function hasRenderableData(state: DataState): boolean {
  return state === 'loaded' || state === 'updating' || state === 'error-stale'
}

/** 判断当前状态是否应展示骨架/加载态（无数据时）。 */
export function isPendingState(state: DataState): boolean {
  return state === 'loading' || state === 'idle'
}
