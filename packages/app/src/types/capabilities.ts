/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Re-export the browser-safe product-level hosted capability facts including the additive content capability.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 * Migration (2026-07-25): authoritative contract now in the browser-safe hosted contract entry.
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 *   `stores.content.inspect` is the additive capability advertising the readonly Store-content projection.
 *
 * 关键不变式（AGENTS.md）：
 *  - 运行时能力是客观兼容性事实，不是权限、不授权、不推断工作流状态。
 *  - 协议版本要求决定一个 backend 能否连接；可选能力只决定哪些界面可渲染。
 *  - 操作可应用性与失败原因必须来自 CLI 结果与诊断，而非额外的前端能力推断。
 *  - 基线能力词汇为 stores.inspect/stores.mutate/contexts.inspect；stores.content.inspect 是
 *    仅在实现只读 Store 内容投影时才声明的附加兼容性事实，不构成授权或空 Store 推断。
 */
export {
  hasCapability,
  type StoreCapability,
  type StoreCapabilitySet,
} from '@openspecui/core/hosted-contract'
