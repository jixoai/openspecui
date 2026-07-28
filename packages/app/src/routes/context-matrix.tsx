/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Project observed project-to-Root and Reference relationships by environment.
 * 2. Avoid machine-wide completeness claims.
 * 3. Preserve each source's Root lifecycle, typed failure, and direct Reference provenance.
 * 4. Render retained evidence and current attempts without hybrid attribution.
 * 5. Use shared realtime atoms for unresolved and retained-refresh presentation.
 *
 * Original request (2026-07-15): "我仍然需要看到一个初版的 Store Manager。"
 * Correction request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 * Original request (2026-07-27): "统一修复所有类似的问题，特别是app 那边新增的页面。"
 * Original request (2026-07-28): "你说的组件化封装是必要的。"
 */
import { RealtimeRevalidateCue } from '@openspecui/web-src/components/realtime/realtime-cue'
import { AccessibleStatus } from '@openspecui/web-src/components/realtime/realtime-primitives'
import {
  RealtimeSkeletonInventory,
  RealtimeSkeletonLine,
} from '@openspecui/web-src/components/realtime/realtime-skeleton'
import { Columns3 } from 'lucide-react'
import { EmptyView, ErrorView } from '../components/state-views'
import { StoreManagerShell } from '../components/store-manager-shell'
import { useConnectionObservations } from '../lib/connection-observation'
import { projectRootObservation, useEnvironmentObservation } from '../lib/use-environment'
import type {
  ProjectContextObservation,
  ProjectObservationSource,
  ProjectRootAttempt,
  ProjectRootEvidence,
} from '../types/root-context'

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
  const { observations: connectionObservations } = useConnectionObservations()
  const current = connectionObservations.filter(
    (observation) =>
      observation.current && observation.reachability === 'online' && observation.health
  )
  const observations = current.flatMap((observation) =>
    observation.health
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
  const rootContextObservations = connectionObservations.map(projectRootObservation)
  const derived = useEnvironmentObservation(observations, rootContextObservations)
  const projectContexts = derived.projectContexts
  const isLoading =
    derived.isLoading ||
    connectionObservations.some(
      (observation) =>
        observation.reachability === 'checking' ||
        (observation.current && observation.rootAttempt.status === 'loading')
    )
  const error =
    derived.error ??
    connectionObservations.flatMap((observation) =>
      observation.rootAttempt.error
        ? [new Error(`${observation.apiBaseUrl}: ${observation.rootAttempt.error.message}`)]
        : []
    )[0] ??
    null

  let body
  if (isLoading && projectContexts.length === 0) {
    body = <RealtimeSkeletonInventory mode="list-divide" count={4} rowClassName="h-16" />
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

  return (
    <StoreManagerShell>
      <RealtimeRevalidateCue active={isLoading && projectContexts.length > 0}>
        {body}
      </RealtimeRevalidateCue>
    </StoreManagerShell>
  )
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
              <tr key={projectContextKey(context)}>
                <td className="border-border border-b p-2">
                  <div className="font-medium">{projectLabel(context)}</div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {projectSource(context).apiBaseUrl}
                  </div>
                  {context.stale ? (
                    <div className="text-muted-foreground text-xs">retained stale snapshot</div>
                  ) : null}
                </td>
                <td className="border-border border-b p-2">
                  <div className="space-y-2">
                    <RootEvidence evidence={context.evidence} />
                    <RootAttempt attempt={context.attempt} evidence={context.evidence} />
                  </div>
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

function MatrixCell({ context, storeId }: { context: ProjectContextObservation; storeId: string }) {
  const evidence = context.evidence
  if (evidence?.storeId === storeId) {
    return <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-xs">Root</span>
  }
  const reference = evidence?.references.find((reference) => reference.storeId === storeId)
  if (reference) {
    return (
      <div className="space-y-1 text-xs">
        <span
          className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-700 dark:text-sky-300"
          aria-label={`${projectLabel(context)} references ${storeId} (${reference.state})`}
          title={reference.root}
        >
          Reference · {reference.state}
        </span>
        <div className="text-muted-foreground font-mono" data-reference-source>
          {reference.source.apiBaseUrl}
        </div>
        {reference.diagnostics.map((diagnostic, index) => (
          <div key={`${diagnostic.severity}:${diagnostic.code}:${index}`} className="space-y-0.5">
            <div className="font-mono">
              [{diagnostic.severity}] {diagnostic.code}
            </div>
            <div>{diagnostic.message}</div>
          </div>
        ))}
      </div>
    )
  }
  // 中性表达：不是 "unreferenced"，而是 "no reference currently observed"。
  return <span className="text-muted-foreground text-xs">—</span>
}

function RootEvidence({ evidence }: { evidence: ProjectRootEvidence | null }) {
  if (!evidence) return null
  return evidence.storeId ? (
    <span className="font-mono text-xs">{evidence.storeId}</span>
  ) : (
    <span className="text-muted-foreground text-xs">{evidence.rootSource ?? 'unresolved'}</span>
  )
}

function RootAttempt({
  attempt,
  evidence,
}: {
  attempt: ProjectRootAttempt
  evidence: ProjectRootEvidence | null
}) {
  const isReplacement = Boolean(evidence && !isSameSource(evidence.source, attempt.source))
  if (attempt.status === 'ready' && !isReplacement) return null
  if (attempt.status === 'error') {
    const detail = attempt.error
      ? attempt.error.source === 'root-context'
        ? `${attempt.error.code}: ${attempt.error.message}`
        : attempt.error.message
      : 'Unknown Root Context failure.'
    return (
      <div className="space-y-1" role="status">
        <div className="text-destructive text-xs font-medium">
          {isReplacement ? 'Latest Root attempt failed' : 'Root error'}
        </div>
        <div className="text-destructive/80 text-xs">{detail}</div>
        <RootAttemptSource attempt={attempt} />
      </div>
    )
  }
  if (attempt.status === 'loading' || attempt.status === 'idle' || isReplacement) {
    return (
      <div className="text-muted-foreground space-y-1 text-xs">
        <RealtimeSkeletonLine className="w-20" />
        <AccessibleStatus>Root {attempt.status}</AccessibleStatus>
        {isReplacement ? <RootAttemptSource attempt={attempt} /> : null}
      </div>
    )
  }
  return null
}

function RootAttemptSource({ attempt }: { attempt: ProjectRootAttempt }) {
  return (
    <dl
      aria-label="Latest Root attempt source"
      className="text-muted-foreground space-y-0.5 font-mono text-xs"
    >
      <div>
        <dt className="sr-only">Backend locator</dt>
        <dd>{attempt.source.apiBaseUrl}</dd>
      </div>
      <div>
        <dt className="sr-only">Observation generation</dt>
        <dd>generation {attempt.source.generation}</dd>
      </div>
      {attempt.source.health?.envUri ? (
        <div>
          <dt className="sr-only">Environment identity</dt>
          <dd>{attempt.source.health.envUri}</dd>
        </div>
      ) : null}
      <div>
        <dt className="sr-only">Observation time</dt>
        <dd>observed {attempt.source.observedAt}</dd>
      </div>
    </dl>
  )
}

function projectSource(context: ProjectContextObservation): ProjectObservationSource {
  return context.evidence?.source ?? context.attempt.source
}

function projectLabel(context: ProjectContextObservation): string {
  const source = projectSource(context)
  return source.health?.projectName ?? source.apiBaseUrl
}

function projectContextKey(context: ProjectContextObservation): string {
  const { source } = context.attempt
  return `${source.tabId}:${source.sessionId}:${source.tabCreatedAt}:${source.generation}`
}

function isSameSource(left: ProjectObservationSource, right: ProjectObservationSource): boolean {
  return (
    left.tabId === right.tabId &&
    left.sessionId === right.sessionId &&
    left.apiBaseUrl === right.apiBaseUrl &&
    left.tabCreatedAt === right.tabCreatedAt &&
    left.generation === right.generation
  )
}

function collectObservedStoreIds(contexts: ProjectContextObservation[]): string[] {
  const set = new Set<string>()
  for (const context of contexts) {
    if (context.evidence?.storeId) set.add(context.evidence.storeId)
    for (const reference of context.evidence?.references ?? []) set.add(reference.storeId)
  }
  return Array.from(set).sort()
}
