/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Re-export backend-owned Store mutation lifecycle facts from @openspecui/core.
 * 2. Preserve the legacy `isTerminalStatus` name for existing App call sites.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 * Migration (2026-07-23): authoritative contract now in @openspecui/core/hosted-protocol.
 *
 * 关键不变式（AGENTS.md）：
 *  - Store 变更是 backend-owned 操作，生命周期：accepted -> running -> succeeded | failed。
 *  - 客户端断开只 detach 观察；它不杀 CLI。丢失不可恢复的终端结果是 indeterminate，绝不伪造为失败或取消。
 *  - V1 不暴露 Cancel，不做任何自动重试。
 *  - 一个 client request id 在单个 backend 进程内对 mutation start 去重。
 *  - 最终结果保留 CLI JSON、诊断、stdout/stderr 与 exit status。
 *  - 每个 terminal 或 indeterminate 结果在下次拉取前使受影响的投影失效。
 */
import { isTerminalMutationStatus, type StoreMutationStatus } from '@openspecui/core'

export {
  type StoreMutation,
  type StoreMutationKind,
  type StoreMutationResult,
  type StoreMutationStatus,
} from '@openspecui/core'

/** Legacy alias for `isTerminalMutationStatus`; retained for existing App call sites. */
export function isTerminalStatus(status: StoreMutationStatus): boolean {
  return isTerminalMutationStatus(status)
}
