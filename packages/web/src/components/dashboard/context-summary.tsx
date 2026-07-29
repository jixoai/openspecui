/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Attribute Dashboard planning metrics to the active CLI-selected root.
 * 2. Omit the healthy same-root default while preserving decision-relevant scope facts.
 * 3. Keep Root, Reference-error, and Git-binding failures directly visible.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 distinguishes pending Planning Git.
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Original request (2026-07-28): restore 5.x-like clarity while keeping 6.x context facts retrievable.
 * Owner same-root direction (2026-07-29): hide redundant Dashboard context when Launch equals Planning.
 */
import { InformationBadge } from '@/components/information-disclosure'
import { RealtimeRevalidateCue, RealtimeSkeletonLine } from '@/components/realtime'
import { selectRootTopology } from '@/lib/root-topology'
import { selectRootContextSnapshot, useContextSubscription } from '@/lib/use-context-subscription'
import { useGitRepositoryScopes } from '@/lib/use-git-repository-scope'
import { VTLink } from '@/lib/view-transitions/navigation'
import type {
  CliDoctorReferenceEntry,
  GitRepositoryScopes,
  StaticGitRepositoryScopes,
} from '@openspecui/core'
import { AlertCircle, FileStack } from 'lucide-react'

/** Root Context and scoped Git facts shown in the Dashboard summary. */
export interface DashboardContextSummaryProps {
  staticMode: boolean
}

/** Dashboard provenance band for planning data, References, and Git scopes. */
export function DashboardContextSummary({ staticMode }: DashboardContextSummaryProps) {
  if (staticMode) return null
  return <LiveDashboardContextSummary />
}

function LiveDashboardContextSummary() {
  const { data: projection, isLoading, error: contextTransportError } = useContextSubscription()
  const context = selectRootContextSnapshot(projection)
  const gitScopesQuery = useGitRepositoryScopes()

  const contextError = projection?.state === 'error' ? projection.error : null
  const referenceCounts = context ? summarizeReferenceDiagnostics(context.references) : null
  const referenceErrorLabels =
    context?.references
      .map((reference) => ({
        storeId: reference.store_id,
        errors: reference.status.filter((diagnostic) => diagnostic.severity === 'error').length,
      }))
      .filter((entry) => entry.errors > 0) ?? []
  const gitFailure =
    gitScopesQuery.authority.state === 'failed'
      ? gitScopesQuery.authority.error.message
      : gitScopesQuery.authority.state === 'current' &&
          gitScopesQuery.data?.planningState === 'failed'
        ? gitScopesQuery.data.planningError.message
        : null
  const hideHealthyCollapsedSummary =
    projection?.state === 'ready' &&
    selectRootTopology(context) === 'collapsed' &&
    context?.references.length === 0 &&
    !contextTransportError &&
    !contextError &&
    gitScopesQuery.authority.state === 'current' &&
    gitScopesQuery.data?.planningState === 'settled' &&
    gitScopesQuery.data.planning === null &&
    !gitFailure

  if (hideHealthyCollapsedSummary) return null

  return (
    <section aria-label="Dashboard data scopes" className="border-border border-y py-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="sr-only">Data scopes</h2>
        {isLoading && !context ? (
          <div className="min-w-0 flex-1" aria-busy="true">
            <RealtimeSkeletonLine className="w-52" />
          </div>
        ) : context ? (
          <RealtimeRevalidateCue active={projection?.state === 'refreshing'}>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <FileStack className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate text-sm" title={context.planningRoot?.path}>
                {context.planningRoot?.path ?? 'No planning root resolved.'}
              </span>
              <InformationBadge
                ariaLabel={`Planning root source ${context.planningRoot?.source ?? 'unresolved'}${context.storeId ? `, Store ${context.storeId}` : ''}`}
                tooltip={
                  <div className="space-y-1">
                    <div>Planning root: {context.planningRoot?.path ?? 'Not resolved'}</div>
                    <div>Source: {context.planningRoot?.source ?? 'unresolved'}</div>
                    <div>Store: {context.storeId ?? 'none'}</div>
                  </div>
                }
              >
                {context.storeId
                  ? `Store ${context.storeId}`
                  : (context.planningRoot?.source ?? 'unresolved')}
              </InformationBadge>
              <InformationBadge
                ariaLabel={`${context.references.length} direct References, ${referenceCounts?.errors ?? 0} errors, ${referenceCounts?.warnings ?? 0} warnings`}
                tooltip={<ReferenceEvidence references={context.references} />}
                tone={referenceCounts?.errors ? 'custom' : 'muted'}
                className={
                  referenceCounts?.errors
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : undefined
                }
              >
                References {context.references.length}
              </InformationBadge>
              {gitScopesQuery.authority.state === 'current' && gitScopesQuery.data ? (
                <InformationBadge
                  ariaLabel={formatGitBadgeAccessibleLabel(gitScopesQuery.data)}
                  tooltip={<GitScopeEvidence scopes={gitScopesQuery.data} />}
                >
                  {gitScopesQuery.data.planningState === 'resolving'
                    ? 'Git resolving'
                    : `Git ${gitScopesQuery.data.planning ? '2 repos' : '1 repo'}`}
                </InformationBadge>
              ) : gitScopesQuery.authority.state === 'waiting' ? (
                <RealtimeSkeletonLine className="w-16" />
              ) : null}
            </div>
          </RealtimeRevalidateCue>
        ) : null}
        <VTLink to="/context" className="text-primary text-xs hover:underline">
          Context
        </VTLink>
      </div>

      {contextTransportError || contextError ? (
        <div className="text-destructive mt-2 flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{contextTransportError?.message ?? contextError?.message}</span>
        </div>
      ) : null}

      {referenceErrorLabels.length > 0 ? (
        <div className="text-destructive mt-2 flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Reference errors:{' '}
            {referenceErrorLabels.map(({ storeId, errors }) => `${storeId} (${errors})`).join(', ')}
          </span>
        </div>
      ) : null}
      {gitFailure ? (
        <div className="text-destructive mt-2 flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Git scope binding failed: {gitFailure}</span>
        </div>
      ) : null}
    </section>
  )
}

function summarizeReferenceDiagnostics(references: CliDoctorReferenceEntry[]) {
  return references.reduce(
    (counts, reference) => {
      counts.total += reference.status.length
      counts.errors += reference.status.filter(
        (diagnostic) => diagnostic.severity === 'error'
      ).length
      counts.warnings += reference.status.filter(
        (diagnostic) => diagnostic.severity === 'warning'
      ).length
      return counts
    },
    { errors: 0, warnings: 0, total: 0 }
  )
}

function ReferenceEvidence({ references }: { references: CliDoctorReferenceEntry[] }) {
  if (references.length === 0) return <span>No direct References observed.</span>
  return (
    <ul className="space-y-1">
      {references.map((reference) => {
        const counts = summarizeReferenceDiagnostics([reference])
        return (
          <li key={reference.store_id}>
            {reference.store_id}: {counts.errors} error · {counts.warnings} warning · {counts.total}{' '}
            total
          </li>
        )
      })}
    </ul>
  )
}

type DashboardGitScopes = GitRepositoryScopes | StaticGitRepositoryScopes

function formatGitBadgeAccessibleLabel(scopes: DashboardGitScopes): string {
  if (scopes.planningState === 'resolving') return 'Code Git current, Planning Git resolving'
  return scopes.planning ? 'Code and distinct Planning Git repositories' : 'Code Git repository'
}

function GitScopeEvidence({ scopes }: { scopes: DashboardGitScopes }) {
  const codePath = scopes.code.repository?.topLevel ?? scopes.code.rootPath
  return (
    <div className="space-y-1">
      <div>Code repository: {codePath}</div>
      {scopes.planningState === 'resolving' ? (
        <div>Resolving Planning Git repository.</div>
      ) : scopes.planningState === 'failed' ? (
        <div>Planning Git repository binding failed: {scopes.planningError.message}</div>
      ) : scopes.planning ? (
        <div>
          Distinct Planning repository:{' '}
          {scopes.planning.repository?.topLevel ?? scopes.planning.rootPath}
        </div>
      ) : (
        <div>No distinct Planning Git repository.</div>
      )}
    </div>
  )
}
