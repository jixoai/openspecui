/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Define hosted environment and observed project Context projections.
 * 2. Preserve upstream Store payloads without browser-owned registry semantics.
 * 3. Separate retained Root/Reference evidence from the current source-labelled attempt.
 * 4. Reuse browser-safe hosted schema-inferred projections instead of asserted ingress contracts.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 * Correction request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
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
  HostedBackendHealthResponse,
  HostedCliDiagnostic,
  HostedRootContextErrorCode,
  HostedRootContextState,
  HostedRootSource,
  HostedStoreDoctorEnvelope,
  HostedStoreListEnvelope,
} from '@openspecui/core/hosted-contract'
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
  /** 同一环境下每个已观察项目；不会折叠为一个无解释的代表 URL。 */
  connectedProjects: HostedEnvironmentProject[]
  /** 观察时间戳（ms）。 */
  observedAt: number
}

/** One concrete connected project observed under a backend-issued environment identity. */
export interface HostedEnvironmentProject {
  tabId: string
  generation: number
  apiBaseUrl: string
  projectName?: string
  cliVersion?: string
  capabilities?: StoreCapabilitySet
}

/** Exact Root lifecycle observed from one connected project source. */
export type RootObservationStatus = 'idle' | HostedRootContextState['state']

/** Root contract and transport failures remain separate typed evidence. */
export type RootObservationError =
  | { source: 'root-context'; code: HostedRootContextErrorCode; message: string }
  | { source: 'transport'; message: string }

/**
 * 一个在线已连接项目的 Context 投影（`openspec context --json` 的客观事实）。
 *
 * TODO(kernel): `openspec context --json` 的精确字段集待用 v1.6 source 审计后确定；
 * 这里先以 root + references 的中性结构占位，backend 落地后替换为强类型适配器。
 */
export interface ProjectObservationSource {
  tabId: string
  sessionId: string
  generation: number
  /** backend 实例定位符。 */
  apiBaseUrl: string
  tabCreatedAt: number
  /** Exact health payload observed for this source; null before health is known. */
  health: HostedBackendHealthResponse | null
  /** 观察时间戳（ms）。 */
  observedAt: number
}

/** Last committed Root/Reference evidence with the exact source that produced it. */
export interface ProjectRootEvidence {
  source: ProjectObservationSource & { health: HostedBackendHealthResponse }
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
  diagnostics?: HostedCliDiagnostic[]
}

/** Current generation's Root lifecycle and failure, kept separate from retained evidence. */
export interface ProjectRootAttempt {
  source: ProjectObservationSource
  status: RootObservationStatus
  error?: RootObservationError
}

/** One connected project's non-interchangeable committed evidence and current attempt. */
export interface ProjectContextObservation {
  evidence: ProjectRootEvidence | null
  attempt: ProjectRootAttempt
  /** 是否为最后观察的 stale 快照（项目离线时）。 */
  stale?: boolean
}

/** CLI root 选择来源。 */
export type RootSource = HostedRootSource

/** 观察到的直接 Reference（一层，只读 Spec 源）。 */
export interface ObservedReference {
  storeId: string
  /** Exact resolved Reference root when Doctor reports it. */
  root?: string
  /** Exact connected-project observation that supplied this direct Reference. */
  source: ProjectObservationSource & { health: HostedBackendHealthResponse }
  /** Raw direct Doctor diagnostics retained without reinterpretation. */
  diagnostics: HostedCliDiagnostic[]
  /** Reference 健康事实（客观保留 CLI 诊断，不推断为权限/完整性结论）。 */
  state: ReferenceState
  /** 诊断原文（若 missing/unhealthy/self-reference）。 */
  note?: string
}

/** Reference 客观状态（来自 CLI，不解释为所有权结论）。 */
export type ReferenceState = 'observed' | HostedCliDiagnostic['severity']

/**
 * Store Inspector 投影来源：`openspec store doctor [id] --json`。
 * 复用 core 现有强类型（store-types.ts），不重定义上游事实。
 */
export type StoreInspectorProjection = HostedStoreDoctorEnvelope

/**
 * Store Inventory 投影来源：`openspec store list --json`。
 * 复用 core 现有强类型（store-types.ts）。
 */
export type StoreInventoryProjection = HostedStoreListEnvelope
