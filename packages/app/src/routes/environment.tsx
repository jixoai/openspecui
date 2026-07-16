/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Group online backends by opaque backend-issued environment identity.
 * 2. Expose capabilities as compatibility facts rather than permissions.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 */
import { Link } from '@tanstack/react-router'
import { Boxes, FlaskConical, MonitorSmartphone, Store } from 'lucide-react'
import { EmptyView } from '../components/state-views'
import { useEnvironmentObservation } from '../lib/use-environment'

/**
 * Environment Center：按 opaque envUri 分组在线 backend。
 *
 * 展示 connected projects、capabilities（兼容性事实，非权限）、data-scope 诊断。
 *
 * 关键中性约束（AGENTS.md）：
 *  - envUri 由后端权威下发；App 不从 URL 推断环境身份。
 *  - Context 视图只说 "observed references" / "no reference currently observed"，
 *    绝不说 "all references" 或 "unreferenced"。
 *  - 离线项目是 unknown，除非显式展示带时间戳的 stale 快照。
 *
 * TODO(kernel): envUri + capabilities 协议落地前，本页为空态骨架。
 */
export function EnvironmentRoute() {
  const { environments } = useEnvironmentObservation()

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <MonitorSmartphone className="h-6 w-6 shrink-0" />
          Environment Center
        </h1>
        <Link
          to="/environment/stores/inspector"
          className="hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
        >
          <Store className="h-4 w-4" />
          Store Manager
          <FlaskConical className="text-muted-foreground h-3.5 w-3.5" />
        </Link>
      </div>

      <p className="text-muted-foreground text-sm">
        Runtime environments are identified by an opaque{' '}
        <code className="bg-muted rounded px-1">envUri</code> issued by each backend. Grouping
        reflects backend host identity plus the effective OpenSpec data home.
      </p>

      {environments.length === 0 ? (
        <EmptyView title="No runtime environments observed">
          {/* TODO(kernel): 连接 backend 后，其 health 响应将携带 envUri，此处按 envUri 分组展示。 */}
          Connect a backend to observe its runtime environment.
        </EmptyView>
      ) : (
        <div className="space-y-3">
          {environments.map((env) => (
            <article key={env.envUri} className="border-border space-y-3 rounded-lg border p-4">
              <header className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Boxes className="text-muted-foreground h-4 w-4" />
                  <span className="font-mono text-sm">{maskEnvUri(env.envUri)}</span>
                </div>
                {env.cliVersion ? (
                  <span className="text-muted-foreground text-xs">CLI {env.cliVersion}</span>
                ) : null}
              </header>
              {env.capabilities && env.capabilities.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {env.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * envUri 是 opaque 的，前端不解析其内部结构。这里仅做展示截断，避免误以为是可解引用的 URL。
 */
function maskEnvUri(envUri: string): string {
  if (envUri.length <= 24) return envUri
  return `${envUri.slice(0, 12)}…${envUri.slice(-8)}`
}
