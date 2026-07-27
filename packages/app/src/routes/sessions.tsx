/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Mark the route that makes the AppLayout-owned HostedShell visible.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 */
/**
 * Sessions is a route marker; persistent iframe ownership belongs to AppLayout.
 */
export function SessionsRoute() {
  return null
}
