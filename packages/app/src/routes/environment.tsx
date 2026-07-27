/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Group online backends by opaque backend-issued environment identity.
 * 2. Expose capabilities as compatibility facts rather than permissions.
 * 3. Present every grouped connected project without a representative-locator collapse.
 * 4. Distinguish unresolved observation from committed empty and retain groups during refresh.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 */
import { RealtimeRevalidateCue } from '@openspecui/web-src/components/realtime/realtime-cue'
import { RealtimeSkeletonInventory } from '@openspecui/web-src/components/realtime/realtime-skeleton'
import { Link } from '@tanstack/react-router'
import { Boxes, FlaskConical, MonitorSmartphone, Store } from 'lucide-react'
import { EmptyView } from '../components/state-views'
import { useConnectionObservations } from '../lib/connection-observation'
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
  const { observations: connectionObservations } = useConnectionObservations()
  const hasPendingObservations = connectionObservations.some(
    (observation) => observation.reachability === 'checking'
  )
  const observations = connectionObservations.flatMap((observation) =>
    observation.health &&
    ((observation.current && observation.reachability === 'online') ||
      observation.reachability === 'checking')
      ? [
          {
            tabId: observation.tabId,
            generation: observation.generation,
            apiBaseUrl: observation.apiBaseUrl,
            health: observation.health,
          },
        ]
      : []
  )
  const { environments } = useEnvironmentObservation(observations)

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

      {hasPendingObservations && environments.length === 0 ? (
        <>
          <RealtimeSkeletonInventory mode="list-divide" count={3} rowClassName="h-24" />
          <span className="rt-sr-status" role="status">
            Loading runtime environments
          </span>
        </>
      ) : environments.length === 0 ? (
        <EmptyView title="No runtime environments observed">
          {/* TODO(kernel): 连接 backend 后，其 health 响应将携带 envUri，此处按 envUri 分组展示。 */}
          Connect a backend to observe its runtime environment.
        </EmptyView>
      ) : (
        <RealtimeRevalidateCue active={hasPendingObservations}>
          <div className="space-y-3">
            {environments.map((env) => (
              <article key={env.envUri} className="border-border space-y-3 rounded-lg border p-4">
                <header className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Boxes className="text-muted-foreground h-4 w-4" />
                    <span className="font-mono text-sm">{maskEnvUri(env.envUri)}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {env.connectedProjects.length} connected{' '}
                    {env.connectedProjects.length === 1 ? 'project' : 'projects'}
                  </span>
                </header>
                <div className="border-border divide-border divide-y rounded-md border">
                  {env.connectedProjects.map((project) => (
                    <div key={project.tabId} className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {project.projectName ?? project.apiBaseUrl}
                          </div>
                          <div className="text-muted-foreground truncate font-mono text-xs">
                            {project.apiBaseUrl}
                          </div>
                        </div>
                        {project.cliVersion ? (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            CLI {project.cliVersion}
                          </span>
                        ) : null}
                      </div>
                      {project.capabilities && project.capabilities.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {project.capabilities.map((capability) => (
                            <span
                              key={capability}
                              className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs"
                            >
                              {capability}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </RealtimeRevalidateCue>
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
