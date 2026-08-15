/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Expose the public OpenSpec CLI 1.6-1.9 command-contract surface.
 * 2. Keep command evidence, common facts, Store facts, and workflow facts discoverable together.
 *
 * 3. Expose the focused Schema-resolution contract module.
 * Original request (2026-07-15): "为不同命令建立强类型适配器，不实现平行解析规则。"

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
export * from './command-result.js'
export * from './common.js'
export * from './executor.js'
export * from './schema-resolution.js'
export * from './store.js'
export * from './workflow.js'
