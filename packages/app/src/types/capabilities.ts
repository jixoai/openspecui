/**
 * Hosted-protocol capability vocabulary.
 *
 * TODO(kernel): 待 packages/server 实现后端协议后，此类型迁移至 @openspecui/core 并由后端权威输出。
 * 依据 AGENTS.md（2026-07-15 决策）与 hosted-environment-store-protocol 定义。
 *
 * 关键不变式（AGENTS.md）：
 *  - 运行时能力是客观兼容性事实，不是权限、不授权、不推断工作流状态。
 *  - 协议版本要求决定一个 backend 能否连接；可选能力只决定哪些界面可渲染。
 *  - 操作可应用性与失败原因必须来自 CLI 结果与诊断，而非额外的前端能力推断。
 *  - 能力词汇仅限下面三项，不得把每个 CLI 子命令镜像成能力。
 */

/** 产品级 Store/Context 能力。仅三项，不镜像 CLI 子命令。 */
export type StoreCapability = 'stores.inspect' | 'stores.mutate' | 'contexts.inspect'

/** 能力集（只读，便于 backend 下发与前端只读消费）。 */
export type StoreCapabilitySet = readonly StoreCapability[]

/** 判断 backend 是否具备某项能力（纯事实查询，无副作用）。 */
export function hasCapability(
  capabilities: StoreCapabilitySet | undefined,
  capability: StoreCapability
): boolean {
  return Boolean(capabilities?.includes(capability))
}
