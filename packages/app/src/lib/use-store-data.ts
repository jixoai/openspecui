import type { StoreDoctorResult, StoreListResult } from '@openspecui/core/store-types'
import type { StoreInspectorProjection, StoreInventoryProjection } from '../types/root-context'
import type { StoreMutation } from '../types/store-mutation'

/**
 * Store Inspector / Inventory 数据源（骨架）。
 *
 * TODO(kernel): 此处是 Store 视图与后端的核心对接点。
 *  - Inspector 投影 `openspec store doctor [id] --json`（stores.inspect 能力）。
 *  - Inventory 投影 `openspec store list --json`（stores.inspect 能力）。
 *  - Hosted 封套可加 provenance（envUri、CLI 版本、观察时间、exit status），但不替换/重解释上游事实。
 *  - 变更（stores.mutate 能力）是 backend-owned 生命周期，经 push invalidation -> client pull 刷新投影。
 *
 * 当前骨架阶段：后端无 store 投影协议，返回空 + 非加载态，视图渲染空态。
 */
export interface StoreDataState {
  /** Store Inspector 投影（doctor）。 */
  inspector: StoreInspectorProjection | undefined
  /** Store Inventory 投影（list）。 */
  inventory: StoreInventoryProjection | undefined
  /** 是否正在加载。 */
  isLoading: boolean
  /** 最近错误。 */
  error: Error | null
  /** 进行中的变更（accepted/running）。 */
  activeMutations: StoreMutation[]
  /** 最近完成的变更（succeeded/failed/indeterminate）。 */
  recentMutations: StoreMutation[]
}

export function useStoreData(): StoreDataState {
  // TODO(kernel): 待 backend store 投影协议落地，替换为真实订阅（push invalidation -> client pull）。
  //               当前骨架无数据源，返回空投影 + 非加载态。
  return {
    inspector: undefined as StoreDoctorResult | undefined,
    inventory: undefined as StoreListResult | undefined,
    isLoading: false,
    error: null,
    activeMutations: [],
    recentMutations: [],
  }
}
