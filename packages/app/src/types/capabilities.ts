/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Re-export the three product-level hosted capability facts from @openspecui/core.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 * Migration (2026-07-23): authoritative contract now in @openspecui/core/hosted-protocol.
 *
 * 关键不变式（AGENTS.md）：
 *  - 运行时能力是客观兼容性事实，不是权限、不授权、不推断工作流状态。
 *  - 协议版本要求决定一个 backend 能否连接；可选能力只决定哪些界面可渲染。
 *  - 操作可应用性与失败原因必须来自 CLI 结果与诊断，而非额外的前端能力推断。
 *  - 能力词汇仅限三项，不得把每个 CLI 子命令镜像成能力。
 */
export { hasCapability, type StoreCapability, type StoreCapabilitySet } from '@openspecui/core'
