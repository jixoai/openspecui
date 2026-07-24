/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Re-export browser-safe backend-issued runtime environment identity.
 * 2. Prevent App code from importing Node-only environment identity computation.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 * Migration (2026-07-25): the App consumes only `hosted-contract`; server-side computation remains
 * Node-owned and is intentionally unavailable to browser consumers.
 *
 * 关键不变式（AGENTS.md）：
 *  - envUri 是 backend 下发的 opaque、不可解引用的 URI，标识「backend 主机身份 + 生效 OpenSpec data home」组合。
 *  - 多个 backend 进程/项目/端口/API URL 在该组合不变时共享同一 envUri；改变主机或 data home 会改变 envUri。
 *  - apiBaseUrl 仍是 backend 实例定位符；App 不得自行构造 envUri，也不得通过它暴露原始 host/data-home 值。
 */
export { asEnvUri, type EnvUri } from '@openspecui/core/hosted-contract'
