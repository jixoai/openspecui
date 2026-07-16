/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Define backend-owned Store mutation lifecycle facts.
 * 2. Preserve terminal CLI evidence and indeterminate loss distinctly.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 */
/**
 * Backend-owned Store mutation lifecycle.
 *
 * TODO(kernel): 待 packages/server 实现后端协议后，此类型迁移至 @openspecui/core 并由后端权威输出。
 * 依据 AGENTS.md（2026-07-15 决策）与 hosted-environment-store-protocol 定义。
 *
 * 关键不变式（AGENTS.md）：
 *  - Store 变更是 backend-owned 操作，生命周期：accepted -> running -> succeeded | failed。
 *  - 客户端断开只 detach 观察；它不杀 CLI。丢失不可恢复的终端结果是 indeterminate，
 *    绝不伪造为失败或取消。
 *  - V1 不暴露 Cancel，不做任何自动重试。
 *  - 一个 client request id 在单个 backend 进程内对 mutation start 去重。
 *  - 最终结果保留 CLI JSON、诊断、stdout/stderr 与 exit status。
 *  - 每个 terminal 或 indeterminate 结果在下次拉取前使受影响的投影失效。
 */

import type { EnvUri } from './env-uri'

/** Store 变更类型（与 CLI 子命令对应：setup / register / unregister / remove）。 */
export type StoreMutationKind = 'setup' | 'register' | 'unregister' | 'remove'

/**
 * 变更生命周期状态。
 * `indeterminate`：不可恢复的终端结果丢失（如 CLI 在断开期间结束且结果未捕获）。
 */
export type StoreMutationStatus = 'accepted' | 'running' | 'succeeded' | 'failed' | 'indeterminate'

/** Store 变更的运行时投影。 */
export interface StoreMutation {
  /** backend 进程内去重用的请求 id。 */
  requestId: string
  /** 目标运行时环境（backend 下发的 opaque identity）。 */
  envUri: EnvUri
  /** 变更种类。 */
  kind: StoreMutationKind
  /** 当前生命周期状态。 */
  status: StoreMutationStatus
  /** 目标 Store id（remove/unregister 必填；setup 时可能尚未确定）。 */
  storeId?: string
  /** 终端结果保留的 CLI JSON / 诊断 / stdout / stderr / exit status（backend 权威输出）。 */
  result?: StoreMutationResult
  /** 观察时间戳（ms，backend 下发）。 */
  observedAt: number
}

/** 终端结果（succeeded/failed/indeterminate）保留的 CLI 原始证据。 */
export interface StoreMutationResult {
  exitStatus: number | null
  stdout?: string
  stderr?: string
  diagnostics?: unknown
  /** CLI 返回的结构化 payload（保留上游事实，不重解释）。 */
  payload?: unknown
}

/** 变更是否处于终端状态（不再转移）。 */
export function isTerminalStatus(status: StoreMutationStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'indeterminate'
}
