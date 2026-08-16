/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Render the Server-owned planning-root target shared by OPSX workflow surfaces.
 * 2. Keep the target path direct while compacting Store, source, and Reference scan facts.
 * 3. Promote stale dispatch authority and direct-Reference errors to visible blockers.
 *
 * Original request (2026-07-20): "New/Propose/Compose/Verify must show the returned target before dispatch."
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip while OPSX stays primary.
 * Original request (2026-08-15): stale 目标收敛为同排琥珀色徽章 + Tooltip，不再展开两行 Alert。
 */
import { InformationBadge } from '@/components/information-disclosure'
import type { WorkflowInvocationTargetV2 } from '@openspecui/core'
import { AlertCircle, GitBranch } from 'lucide-react'

interface ReferenceDiagnosticCounts {
  references: number
  errors: number
  warnings: number
  infos: number
  total: number
}

function summarizeReferenceDiagnostics(
  references: WorkflowInvocationTargetV2['references']
): ReferenceDiagnosticCounts {
  const counts: ReferenceDiagnosticCounts = {
    references: references.length,
    errors: 0,
    warnings: 0,
    infos: 0,
    total: 0,
  }

  for (const reference of references) {
    for (const diagnostic of reference.status) {
      counts.total += 1
      if (diagnostic.severity === 'error') counts.errors += 1
      if (diagnostic.severity === 'warning') counts.warnings += 1
      if (diagnostic.severity === 'info') counts.infos += 1
    }
  }

  return counts
}

function formatReferenceDiagnosticCounts(counts: ReferenceDiagnosticCounts): string {
  const referenceLabel = counts.references === 1 ? 'direct Reference' : 'direct References'
  const errorLabel = counts.errors === 1 ? 'error' : 'errors'
  const warningLabel = counts.warnings === 1 ? 'warning' : 'warnings'
  const infoLabel = counts.infos === 1 ? 'info' : 'infos'
  return `${counts.references} ${referenceLabel} · ${counts.errors} ${errorLabel} · ${counts.warnings} ${warningLabel} · ${counts.infos} ${infoLabel} · ${counts.total} total`
}

/** Render one prepared workflow target; null is intentionally unavailable in static mode. */
export function WorkflowTargetNotice({
  target,
  stale = false,
}: {
  target: WorkflowInvocationTargetV2 | null
  stale?: boolean
}) {
  if (!target) return null
  const referenceDiagnostics = summarizeReferenceDiagnostics(target.references)
  const referenceErrors = target.references
    .map((reference) => ({
      storeId: reference.store_id,
      errors: reference.status.filter((diagnostic) => diagnostic.severity === 'error').length,
    }))
    .filter((entry) => entry.errors > 0)
  return (
    <div
      role="region"
      aria-label="Workflow target"
      className="border-border min-w-0 border-y py-2 text-xs"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <GitBranch className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        <span className="text-muted-foreground">Planning</span>
        <span className="min-w-0 flex-1 break-all font-mono">{target.planningRoot.path}</span>
        <InformationBadge
          ariaLabel={`Planning root source ${target.planningRoot.source}`}
          tooltip={`Root source: ${target.planningRoot.source}`}
        >
          {target.planningRoot.source}
        </InformationBadge>
        {target.storeId ? (
          <InformationBadge
            ariaLabel={`Planning Store ${target.storeId}`}
            tooltip={`The prepared workflow target selected Store ${target.storeId}.`}
          >
            Store {target.storeId}
          </InformationBadge>
        ) : null}
        <InformationBadge
          ariaLabel={formatReferenceDiagnosticCounts(referenceDiagnostics)}
          tooltip={formatReferenceDiagnosticCounts(referenceDiagnostics)}
          tone={referenceDiagnostics.errors > 0 ? 'custom' : 'muted'}
          className={
            referenceDiagnostics.errors > 0
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : undefined
          }
        >
          References {referenceDiagnostics.references}
        </InformationBadge>
        {stale ? (
          <InformationBadge
            ariaLabel="Planning target is stale; dispatch is locked."
            tooltip="The prepared planning target is stale. Re-prepare the workflow before dispatch."
            tone="custom"
            className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          >
            Stale target
          </InformationBadge>
        ) : null}
      </div>
      {referenceErrors.length > 0 ? (
        <div className="text-destructive mt-2 flex items-start gap-2" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Reference errors:{' '}
            {referenceErrors.map(({ storeId, errors }) => `${storeId} (${errors})`).join(', ')}
          </span>
        </div>
      ) : null}
    </div>
  )
}
