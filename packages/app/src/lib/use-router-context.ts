/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Read the typed App launch context from the router owner.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 */
import { useRouter } from '@tanstack/react-router'
import type { AppRouterContext } from '../app-router'

/**
 * 读取注入到 router 的启动上下文。
 *
 * 这让 /sessions（HostedShell）拿到 main.tsx 解析的 launch params，不重复解析。
 * context 通过 createAppRouter(context) 作为 router options.context 注入，从 router.options 读取。
 */
export function useRouterContext(): AppRouterContext {
  const router = useRouter()
  return router.options.context as AppRouterContext
}
