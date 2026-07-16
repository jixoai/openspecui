/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Define the App seam for backend-issued environment and Context observations.
 * 2. Gate Store views through objective hosted-protocol capabilities.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 */
import type { StoreCapabilitySet } from '../types/capabilities'
import type { HostedEnvironment, ProjectContextObservation } from '../types/root-context'

/**
 * 运行时环境数据源（骨架）。
 *
 * TODO(kernel): 此处是前端与后端协议的核心对接点。
 *  - 后端 health 协议落地后，从各 backend 的 health 响应提取 opaque envUri + capabilities。
 *  - 多个 backend 进程/项目/端口在 host identity + data home 不变时共享同一 envUri。
 *  - App 不得自行构造 envUri，也不得通过它暴露原始 host/data-home 值。
 *  - 每个项目的 Context（`openspec context --json`）由 backend 投影，前端只 join。
 *
 * 当前骨架阶段：后端不返回 envUri，因此返回空环境列表。视图据此渲染空态。
 */
export interface EnvironmentObservation {
  /** 按 envUri 分组的运行时环境（observed-only）。 */
  environments: HostedEnvironment[]
  /** 每个在线项目的 Context 观察（observed references，绝不声称机器级完备）。 */
  projectContexts: ProjectContextObservation[]
  /** 是否正在加载。 */
  isLoading: boolean
  /** 最近错误。 */
  error: Error | null
}

/** Read the current backend-issued environment and observed Context projections. */
export function useEnvironmentObservation(): EnvironmentObservation {
  // TODO(kernel): 待 backend envUri 协议落地，替换为真实订阅（push invalidation -> client pull）。
  //               当前骨架无数据源，返回空 + 非加载态，让视图渲染空态。
  return {
    environments: [],
    projectContexts: [],
    isLoading: false,
    error: null,
  }
}

/**
 * 能力可见性判断：决定某个 Store Manager 视图是否渲染。
 *
 * 关键不变式（AGENTS.md）：能力是兼容性事实，不是权限。
 * 没有该能力 → 不渲染对应视图；有该能力 → 可渲染，但操作可应用性仍由 CLI 结果决定。
 */
export function canRenderStoreInspector(capabilities: StoreCapabilitySet | undefined): boolean {
  return Boolean(capabilities?.includes('stores.inspect'))
}
