/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Represent backend-issued runtime environment identity as opaque data.
 * 2. Prevent App code from constructing or dereferencing environment identity.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 */
/**
 * Runtime-environment identity for the hosted protocol.
 *
 * TODO(kernel): 待 packages/server 实现后端协议后，此类型迁移至 @openspecui/core 并由后端权威输出。
 * 字段依据 `openspec/changes/target-openspec-cli-16-line/loop/research-plan.md` 与
 * `wayfinder/research/hosted-environment-store-protocol.md` 定义，当前仅为 UI 投影层占位声明。
 *
 * 关键不变式（AGENTS.md）：
 *  - envUri 是 backend 下发的 opaque、不可解引用的 URI，标识「backend 主机身份 + 生效 OpenSpec data home」组合。
 *  - 多个 backend 进程/项目/端口/API URL 在该组合不变时共享同一 envUri；改变主机或 data home 会改变 envUri。
 *  - apiBaseUrl 仍是 backend 实例定位符；App 不得自行构造 envUri，也不得通过它暴露原始 host/data-home 值。
 */

/**
 * Opaque runtime-environment identity string.
 *
 * Branding 阻止把它当成普通字符串拼接或当作 URL 解析——它不可解引用。
 */
export type EnvUri = string & { readonly __brand: 'EnvUri' }

/**
 * 把后端下发的任意字符串标记为 EnvUri 的唯一合法构造点。
 *
 * TODO(kernel): 实际 envUri 只能来自后端 health/协议响应；这里仅供骨架类型流转。
 */
export function asEnvUri(value: string): EnvUri {
  return value as EnvUri
}
