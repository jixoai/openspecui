/**
 * Hosted runtime environment + project Context observation projections.
 *
 * TODO(kernel): 待 packages/server 实现后端协议后，此类型迁移至 @openspecui/core 并由后端权威输出。
 * 依据 AGENTS.md 与 hosted-environment-store-protocol 定义。
 *
 * 关键中性约束（AGENTS.md）：
 *  - Context Matrix 是仅观察（observed-only）的 App 投影，按 envUri 和 Store id 连接在线已连接项目。
 *  - 它不是机器级反向索引。只能说 "observed references" 或 "no reference currently observed"，
 *    绝不说 "all references" 或 "unreferenced"。
 *  - 离线项目是 unknown，除非显式展示带时间戳与 stale 状态的最后观察快照。
 *  - Inventory 投影 `openspec store list --json`；Inspector 投影 `openspec store doctor [id] --json`；
 *    每个 project Context 投影 `openspec context --json`。Hosted 封套可加 provenance
 *    （envUri、CLI 版本、观察时间、exit status），但不得替换或重解释上游 payload 事实。
 */

import type {
  StoreDiagnostic,
  StoreDoctorResult,
  StoreListResult,
} from '@openspecui/core/store-types'
import type { StoreCapabilitySet } from './capabilities'
import type { EnvUri } from './env-uri'

/**
 * 一个已连接 backend 实例下发的运行时环境。
 *
 * 多个项目/端口/进程在 host identity + data home 不变时共享同一 envUri。
 */
export interface HostedEnvironment {
  /** opaque、stable、不可解引用的环境身份（backend 下发）。 */
  envUri: EnvUri
  /** backend 实例定位符（与 envUri 不同：同 envUri 可有多个 backend 实例）。 */
  apiBaseUrl: string
  /** CLI 版本（provenance）。 */
  cliVersion?: string
  /** backend 实现的可选能力（兼容性事实，非权限）。 */
  capabilities?: StoreCapabilitySet
  /** 观察时间戳（ms）。 */
  observedAt: number
}

/**
 * 一个在线已连接项目的 Context 投影（`openspec context --json` 的客观事实）。
 *
 * TODO(kernel): `openspec context --json` 的精确字段集待用 v1.6 source 审计后确定；
 * 这里先以 root + references 的中性结构占位，backend 落地后替换为强类型适配器。
 */
export interface ProjectContextObservation {
  envUri: EnvUri
  /** backend 实例定位符。 */
  apiBaseUrl: string
  /** 项目显示名（来自 backend health，非 envUri 组成）。 */
  projectName?: string
  /** CLI 解析出的可写 planning root（绝对路径仅用于诊断展示，前端不基于它重构路径）。 */
  planningRoot?: string
  /** planning root 的来源（nearest / declared Store / explicit Store）。 */
  rootSource?: RootSource
  /** 生效 Store id（当 root 来自某个 Store 时）。 */
  storeId?: string
  /**
   * 该项目观察到的直接 Reference Spec 索引（一层，不递归）。
   * 中性表达：observed references；空表示「no reference currently observed」，不是「无引用」。
   */
  references: ObservedReference[]
  /** CLI 诊断（保留上游 snake_case 事实，不重解释为健康/所有权/完整性结论）。 */
  diagnostics?: StoreDiagnostic[]
  /** 观察时间戳（ms）。 */
  observedAt: number
  /** 是否为最后观察的 stale 快照（项目离线时）。 */
  stale?: boolean
}

/** CLI root 选择来源。 */
export type RootSource = 'nearest' | 'declared-store' | 'explicit-store'

/** 观察到的直接 Reference（一层，只读 Spec 源）。 */
export interface ObservedReference {
  storeId: string
  /** Reference 健康事实（客观保留 CLI 诊断，不推断为权限/完整性结论）。 */
  state: ReferenceState
  /** 诊断原文（若 missing/unhealthy/self-reference）。 */
  note?: string
}

/** Reference 客观状态（来自 CLI，不解释为所有权结论）。 */
export type ReferenceState = 'healthy' | 'missing' | 'unhealthy' | 'self-reference'

/**
 * Store Inspector 投影来源：`openspec store doctor [id] --json`。
 * 复用 core 现有强类型（store-types.ts），不重定义上游事实。
 */
export type StoreInspectorProjection = StoreDoctorResult

/**
 * Store Inventory 投影来源：`openspec store list --json`。
 * 复用 core 现有强类型（store-types.ts）。
 */
export type StoreInventoryProjection = StoreListResult
