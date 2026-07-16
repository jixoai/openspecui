/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Attribute Dashboard planning metrics to the active CLI-selected root.
 * 2. Show Store and direct Reference diagnostic evidence without inferred health.
 * 3. Keep the Code Git snapshot distinct from an optional Planning Git repository.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 */
import { selectRootContextSnapshot, useContextSubscription } from '@/lib/use-context-subscription'
import { useGitRepositoryScopes } from '@/lib/use-git-repository-scope'
import { VTLink } from '@/lib/view-transitions/navigation'
import type { CliReferenceIndexEntry } from '@openspecui/core'
import { AlertCircle, Code2, FileStack, GitBranch, Network, RefreshCw } from 'lucide-react'

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

  return (
    <section aria-label="Dashboard data scopes" className="border-border border-y py-3">
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Data scopes</h2>
          <p className="text-muted-foreground text-xs">
            Planning metrics and Git activity are projected from independently named roots.
          </p>
        </div>
        <VTLink to="/context" className="text-primary text-xs hover:underline">
          Full Context
        </VTLink>
      </div>

      {isLoading && !context ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
          Resolving planning root...
        </div>
      ) : null}

      {contextTransportError || contextError ? (
        <div className="text-destructive mb-3 flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{contextTransportError?.message ?? contextError?.message}</span>
        </div>
      ) : null}

      {context ? (
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          <div className="min-w-0 space-y-1">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold">
              <FileStack className="h-3.5 w-3.5" aria-hidden />
              Planning metrics
            </h3>
            <p className="truncate text-sm" title={context.planningRoot?.path}>
              {context.planningRoot?.path ?? 'No planning root resolved.'}
            </p>
            <p className="text-muted-foreground text-xs">
              source: {context.planningRoot?.source ?? 'unresolved'}
              {context.storeId ? ` · Store ${context.storeId}` : ''}
            </p>
          </div>

          <div className="min-w-0 space-y-1">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold">
              <Network className="h-3.5 w-3.5" aria-hidden />
              Reference evidence
            </h3>
            {context.references.length === 0 ? (
              <p className="text-muted-foreground text-xs">No reference currently observed.</p>
            ) : (
              <ul className="space-y-1">
                {context.references.map((reference) => (
                  <ReferenceEvidence key={reference.store_id} reference={reference} />
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold">
              <Code2 className="h-3.5 w-3.5" aria-hidden />
              Code Git snapshot
            </h3>
            {gitScopesQuery.data ? (
              <>
                <p
                  className="truncate text-sm"
                  title={
                    gitScopesQuery.data.code.repository?.topLevel ??
                    gitScopesQuery.data.code.rootPath
                  }
                >
                  {gitScopesQuery.data.code.repository?.topLevel ??
                    gitScopesQuery.data.code.rootPath}
                </p>
                {gitScopesQuery.data.planning ? (
                  <p
                    className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs"
                    title={
                      gitScopesQuery.data.planning.repository?.topLevel ??
                      gitScopesQuery.data.planning.rootPath
                    }
                  >
                    <GitBranch className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">
                      Distinct Planning repository:{' '}
                      {gitScopesQuery.data.planning.repository?.topLevel ??
                        gitScopesQuery.data.planning.rootPath}
                    </span>
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    No distinct Planning Git repository.
                  </p>
                )}
              </>
            ) : gitScopesQuery.error ? (
              <p className="text-destructive text-xs">{gitScopesQuery.error.message}</p>
            ) : (
              <p className="text-muted-foreground text-xs">Resolving Git scopes...</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ReferenceEvidence({ reference }: { reference: CliReferenceIndexEntry }) {
  const errors = reference.status.filter((diagnostic) => diagnostic.severity === 'error').length
  const warnings = reference.status.filter((diagnostic) => diagnostic.severity === 'warning').length
  const evidence =
    reference.status.length === 0
      ? 'No CLI diagnostic'
      : `${errors} error · ${warnings} warning · ${reference.status.length} total`

  return (
    <li className="flex min-w-0 items-baseline justify-between gap-2 text-xs">
      <span className="truncate font-mono" title={reference.store_id}>
        {reference.store_id}
      </span>
      <span className="text-muted-foreground shrink-0">{evidence}</span>
    </li>
  )
}
