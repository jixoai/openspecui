/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Project observed project-to-Root and Reference relationships by environment.
 * 2. Avoid machine-wide completeness claims.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 */
import { Columns3 } from 'lucide-react'
import { EmptyView, ErrorView, LoadingView } from '../components/state-views'
import { StoreManagerShell } from '../components/store-manager-shell'
import { useActiveBackend } from '../lib/use-active-backend'
import { useEnvironmentObservation } from '../lib/use-environment'
import type { ProjectContextObservation } from '../types/root-context'

/**
 * Context Matrix（C 视图，兄弟 Context 视图）：项目 ↔ Root/Reference 关系表。
 *
 * 关键中性约束（AGENTS.md）：
 *  - 仅观察（observed-only）的 App 投影，按 envUri 和 Store id 连接在线已连接项目。
 *  - 不是机器级反向索引。文案只说 "observed references" / "no reference currently observed"，
 *    绝不说 "all references" 或 "unreferenced"。
 *  - 离线项目是 unknown，除非显式展示带时间戳的 stale 快照。
 *
 * TODO(kernel): contexts.inspect 能力决定本视图是否渲染。数据来自每个项目的 `openspec context --json` 投影，
 *               按 envUri × storeId join。
 */
export function ContextMatrixRoute() {
  const { active } = useActiveBackend()
  const observations = active?.health
    ? [{ apiBaseUrl: active.apiBaseUrl, health: active.health }]
    : []
  const rootContextObservations = active?.health
    ? [
        {
          apiBaseUrl: active.apiBaseUrl,
          health: active.health,
          rootContext: active.rootContext,
        },
      ]
    : []
  const { projectContexts, isLoading, error } = useEnvironmentObservation(
    observations,
    rootContextObservations
  )

  let body
  if (isLoading && projectContexts.length === 0) {
    body = <LoadingView label="Loading project contexts..." />
  } else if (error && projectContexts.length === 0) {
    body = <ErrorView message={error.message} />
  } else if (projectContexts.length === 0) {
    body = (
      <EmptyView title="No project contexts observed">
        {/* TODO(kernel): 连接 backend 后，每个项目的 `openspec context --json` 投影在此 join。 */}
        Observed project-to-Root/Reference relationships will appear here once backends are
        connected.
      </EmptyView>
    )
  } else {
    body = renderContextMatrixBody(projectContexts)
  }

  return <StoreManagerShell>{body}</StoreManagerShell>
}

function renderContextMatrixBody(projectContexts: ProjectContextObservation[]) {
  // 收集所有出现过的 Store id（作为列），保证中性：只展示 observed 的，不声称全集。
  const observedStoreIds = collectObservedStoreIds(projectContexts)
  return (
    <div className="space-y-4">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Columns3 className="h-3.5 w-3.5" />
        Observed relationships only — not a machine-wide index.
      </div>
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="border-border border-b p-2 text-left font-medium">Project</th>
              <th className="border-border border-b p-2 text-left font-medium">Root</th>
              {observedStoreIds.map((storeId) => (
                <th
                  key={storeId}
                  className="border-border border-b p-2 text-left font-mono text-xs font-medium"
                >
                  {storeId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projectContexts.map((context) => (
              <tr key={`${context.envUri}:${context.apiBaseUrl}`}>
                <td className="border-border border-b p-2">
                  <div className="font-medium">{context.projectName ?? context.apiBaseUrl}</div>
                  {context.stale ? (
                    <div className="text-muted-foreground text-xs">stale snapshot</div>
                  ) : null}
                </td>
                <td className="border-border border-b p-2">
                  {context.storeId ? (
                    <span className="font-mono text-xs">{context.storeId}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {context.rootSource ?? 'nearest'}
                    </span>
                  )}
                </td>
                {observedStoreIds.map((storeId) => (
                  <td key={storeId} className="border-border border-b p-2">
                    <MatrixCell context={context} storeId={storeId} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MatrixCell({
  context,
  storeId,
}: {
  context: { storeId?: string; references: { storeId: string; state: string }[] }
  storeId: string
}) {
  if (context.storeId === storeId) {
    return <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-xs">Root</span>
  }
  const reference = context.references.find((reference) => reference.storeId === storeId)
  if (reference) {
    return (
      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-700 dark:text-sky-300">
        Reference
      </span>
    )
  }
  // 中性表达：不是 "unreferenced"，而是 "no reference currently observed"。
  return <span className="text-muted-foreground text-xs">—</span>
}

function collectObservedStoreIds(
  contexts: {
    storeId?: string
    references: { storeId: string }[]
  }[]
): string[] {
  const set = new Set<string>()
  for (const context of contexts) {
    if (context.storeId) set.add(context.storeId)
    for (const reference of context.references) set.add(reference.storeId)
  }
  return Array.from(set).sort()
}
