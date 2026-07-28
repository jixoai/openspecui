/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Project CLI-resolved Change, artifact, and planning-home paths without reconstruction.
 * 2. Preserve repo-local action-context facts and constraints.
 * 3. Show direct Reference diagnostics without inferred health or completeness.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 */
import type { ChangeStatus, CliReferenceIndexEntry } from '@openspecui/core'
import { FileCode2, Network } from 'lucide-react'

/** Root/Reference and raw command evidence rendered beside one Change. */
export interface ChangeContextEvidenceProps {
  status: ChangeStatus
  references: CliReferenceIndexEntry[]
}

/** Read-only OpenSpec Status and Root Context evidence for one Change. */
export function ChangeContextEvidence({ status, references }: ChangeContextEvidenceProps) {
  const provenance = status.provenance

  return (
    <section aria-label="Change CLI paths and context" className="border-border border-y py-3">
      <div className="grid min-w-0 gap-3 text-xs md:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-1.5 font-semibold">
            <FileCode2 className="h-3.5 w-3.5" aria-hidden />
            CLI Change context
          </h3>
          {provenance.kind === 'cli' ? (
            <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Change root</dt>
              <dd className="min-w-0 break-all font-mono">{provenance.changeRoot}</dd>
              <dt className="text-muted-foreground">Planning home</dt>
              <dd className="min-w-0 break-all font-mono">{provenance.planningHome.root}</dd>
              <dt className="text-muted-foreground">Root source</dt>
              <dd>
                {provenance.root.source}
                {provenance.root.store_id ? ` · Store ${provenance.root.store_id}` : ''}
              </dd>
              <dt className="text-muted-foreground">Action context</dt>
              <dd>
                {provenance.actionContext.mode} · {provenance.actionContext.sourceOfTruth}
              </dd>
            </dl>
          ) : (
            <p className="text-muted-foreground">Unavailable in this static snapshot.</p>
          )}
        </div>

        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-1.5 font-semibold">
            <Network className="h-3.5 w-3.5" aria-hidden />
            Observed References
          </h3>
          {references.length === 0 ? (
            <p className="text-muted-foreground">No reference currently observed.</p>
          ) : (
            <ul className="space-y-1">
              {references.map((reference) => (
                <li
                  key={reference.store_id}
                  className="flex min-w-0 items-baseline justify-between gap-2"
                >
                  <span className="truncate font-mono" title={reference.store_id}>
                    {reference.store_id}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {formatReferenceEvidence(reference)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {provenance.kind === 'cli' ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium">
            Artifact paths and action context
          </summary>
          <div className="mt-2 space-y-3">
            <dl className="space-y-2">
              {Object.entries(provenance.artifactPaths).map(([artifactId, artifact]) => (
                <div key={artifactId}>
                  <dt className="font-medium">{artifactId}</dt>
                  <dd className="text-muted-foreground break-all font-mono">
                    {artifact.outputPath} {'->'} {artifact.resolvedOutputPath}
                  </dd>
                  <dd className="text-muted-foreground break-all">
                    Existing:{' '}
                    {artifact.existingOutputPaths.length > 0
                      ? artifact.existingOutputPaths.join(', ')
                      : 'none observed'}
                  </dd>
                </div>
              ))}
            </dl>
            <EvidenceList
              label="Allowed edit roots"
              values={provenance.actionContext.allowedEditRoots}
            />
            <EvidenceList
              label="Planning artifacts"
              values={provenance.actionContext.planningArtifacts}
            />
            <EvidenceList
              label="Linked context"
              values={provenance.actionContext.linkedContext.map((entry) => entry.name)}
            />
            <EvidenceList label="Constraints" values={provenance.actionContext.constraints} />
            <EvidenceList label="Next steps" values={provenance.nextSteps} />
          </div>
        </details>
      ) : null}
    </section>
  )
}

function formatReferenceEvidence(reference: CliReferenceIndexEntry): string {
  const errors = reference.status.filter((diagnostic) => diagnostic.severity === 'error').length
  const warnings = reference.status.filter((diagnostic) => diagnostic.severity === 'warning').length
  return reference.status.length === 0
    ? 'No CLI diagnostic'
    : `${errors} error · ${warnings} warning · ${reference.status.length} total`
}

function EvidenceList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground break-all">
        {values.length > 0 ? values.join(', ') : 'none observed'}
      </div>
    </div>
  )
}
