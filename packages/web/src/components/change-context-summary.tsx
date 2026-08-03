/**
 * Orthogonal intents (created 2026-08-03 Asia/Shanghai):
 * 1. Project compact Root, Store, and Reference scan facts for Change Detail.
 * 2. Preserve current, retained, unavailable, and static authority distinctions.
 * 3. Keep Reference failures directly visible without owning subscriptions or mutations.
 *
 * Original request (2026-08-03): keep only necessary Change evidence in the default decision plane.
 */
import { InformationBadge } from '@/components/information-disclosure'
import type { ChangeStatus, CliReferenceIndexEntry } from '@openspecui/core'
import { AlertCircle, FileCode2 } from 'lucide-react'

/** Reference facts already resolved by the Change route for pure presentation. */
export type ChangeReferenceEvidence =
  | {
      state: 'current' | 'retained'
      references: readonly CliReferenceIndexEntry[]
    }
  | {
      state: 'unavailable'
      reason: 'root-context' | 'static'
    }

interface ReferenceCounts {
  errors: number
  warnings: number
  total: number
}

function summarizeReferences(references: readonly CliReferenceIndexEntry[]): ReferenceCounts {
  return references.reduce<ReferenceCounts>(
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

function referenceErrorLabels(references: readonly CliReferenceIndexEntry[]): string[] {
  return references.flatMap((reference) => {
    const errors = reference.status.filter((diagnostic) => diagnostic.severity === 'error').length
    return errors > 0 ? [`${reference.store_id} (${errors})`] : []
  })
}

/** Compact source-attributed facts that remain beside Change workflow actions. */
export function ChangeContextSummary({
  status,
  referenceEvidence,
}: {
  status: ChangeStatus
  referenceEvidence: ChangeReferenceEvidence
}) {
  const provenance = status.provenance
  const references = referenceEvidence.state === 'unavailable' ? null : referenceEvidence.references
  const referenceCounts = references ? summarizeReferences(references) : null
  const referenceErrors = references ? referenceErrorLabels(references) : []

  return (
    <section
      data-change-context-summary=""
      aria-label="Change context summary"
      className="@container min-w-0 space-y-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
        <FileCode2 className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        <span className="font-medium">Change context</span>
        {provenance.kind === 'static' ? (
          <InformationBadge
            ariaLabel="Static Change context has no live backend provenance"
            tooltip="CLI Change context is unavailable in this static snapshot."
          >
            Static snapshot
          </InformationBadge>
        ) : (
          <InformationBadge
            ariaLabel={`Change Root source ${provenance.root.source}${provenance.root.store_id ? `, Store ${provenance.root.store_id}` : ''}`}
            className="max-w-full truncate"
            tooltip={
              <div className="space-y-1">
                <div>Change root: {provenance.changeRoot}</div>
                <div>Planning home: {provenance.planningHome.root}</div>
                <div>Root source: {provenance.root.source}</div>
                <div>Store: {provenance.root.store_id ?? 'none'}</div>
              </div>
            }
          >
            {provenance.root.store_id
              ? `Store ${provenance.root.store_id}`
              : provenance.root.source}
          </InformationBadge>
        )}
        {references && referenceCounts ? (
          <InformationBadge
            ariaLabel={`${referenceEvidence.state === 'retained' ? 'Retained ' : ''}${references.length} observed References, ${referenceCounts.errors} errors, ${referenceCounts.warnings} warnings`}
            tooltip={`${referenceEvidence.state === 'retained' ? 'Retained · ' : ''}${references.length} References · ${referenceCounts.errors} errors · ${referenceCounts.warnings} warnings · ${referenceCounts.total} diagnostics`}
            tone={referenceCounts.errors > 0 ? 'custom' : 'muted'}
            className={
              referenceCounts.errors > 0
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : undefined
            }
          >
            {referenceEvidence.state === 'retained' ? 'Retained ' : ''}References{' '}
            {references.length}
          </InformationBadge>
        ) : (
          <InformationBadge
            ariaLabel="Reference evidence unavailable"
            tooltip={
              referenceEvidence.state === 'unavailable' && referenceEvidence.reason === 'static'
                ? 'Reference evidence is not published in this static snapshot.'
                : 'Reference evidence is unavailable until Root Context is observed.'
            }
          >
            References unavailable
          </InformationBadge>
        )}
      </div>
      {referenceErrors.length > 0 ? (
        <div className="text-destructive flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Reference errors: {referenceErrors.join(', ')}</span>
        </div>
      ) : null}
    </section>
  )
}
