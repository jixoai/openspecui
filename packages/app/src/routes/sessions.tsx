/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Preserve the existing multi-tab HostedShell as the project Sessions surface.
 * 2. Reuse router-owned launch parameters without reparsing them.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 */
import { HostedShell } from '../components/hosted-shell'
import { useRouterContext } from '../lib/use-router-context'

/**
 * Sessions 路由：现有 iframe 多标签 HostedShell，作为项目工作面入口。
 *
 * 这是 OpenSpecUI 的核心增强——一个 App 标签页托管一个项目后端（packages/web 的嵌入 UI）。
 * 启动信息（launch params / fallback / error）由 main.tsx 解析后经 router context 注入，
 * 保证 PWA 首运行 / ?api=... 启动路径与改造前完全一致。
 */
export function SessionsRoute() {
  const ctx = useRouterContext()
  return (
    <HostedShell
      initialLaunchRequest={ctx.initialLaunchRequest}
      fallbackLaunchRequest={ctx.fallbackLaunchRequest}
      initialError={ctx.initialError}
    />
  )
}
