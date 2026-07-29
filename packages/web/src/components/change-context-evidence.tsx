/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Preserve CLI-authored Change paths, action context, and raw Status evidence on demand.
 * 2. Compress Root source, Store, and Reference scan facts without inferred health.
 * 3. Keep direct Reference errors visible outside the collapsed evidence region.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.
 * Owner correction (2026-07-29): Paths and CLI evidence must separate readable facts, artifacts, References, and raw CLI output without mobile overflow.
 */
import { EvidenceDisclosure, InformationBadge } from '@/components/information-disclosure'
import type { ChangeStatus, CliReferenceIndexEntry } from '@openspecui/core'
import { AlertCircle, FileCode2 } from 'lucide-react'

/** Root/Reference and raw command evidence rendered beside one Change. */
export interface ChangeContextEvidenceProps {
  status: ChangeStatus
  references: CliReferenceIndexEntry[]
}

/** Read-only OpenSpec Status and Root Context evidence for one Change. */
export function ChangeContextEvidence({ status, references }: ChangeContextEvidenceProps) {
  const provenance = status.provenance
  const referenceCounts = summarizeReferences(references)
  const referenceErrors = references
    .map((reference) => ({
      storeId: reference.store_id,
      errors: reference.status.filter((diagnostic) => diagnostic.severity === 'error').length,
    }))
    .filter((entry) => entry.errors > 0)

  if (provenance.kind === 'static') {
    return (
      <section
        aria-label="Change CLI paths and context"
        className="border-border flex min-w-0 flex-wrap items-center gap-2 border-y py-2 text-xs"
      >
        <FileCode2 className="text-muted-foreground h-4 w-4" aria-hidden />
        <span className="font-medium">Change context</span>
        <InformationBadge
          ariaLabel="Static Change context has no live backend provenance"
          tooltip="CLI Change context is unavailable in this static snapshot."
        >
          Static snapshot
        </InformationBadge>
      </section>
    )
  }

  return (
    <section aria-label="Change CLI paths and context" className="@container min-w-0 space-y-2">
      <div className="border-border flex min-w-0 flex-wrap items-center gap-2 border-y py-2 text-xs">
        <FileCode2 className="text-muted-foreground h-4 w-4" aria-hidden />
        <span className="font-medium">Change context</span>
        <InformationBadge
          ariaLabel={`Change Root source ${provenance.root.source}${provenance.root.store_id ? `, Store ${provenance.root.store_id}` : ''}`}
          tooltip={
            <div className="space-y-1">
              <div>Change root: {provenance.changeRoot}</div>
              <div>Planning home: {provenance.planningHome.root}</div>
              <div>Root source: {provenance.root.source}</div>
              <div>Store: {provenance.root.store_id ?? 'none'}</div>
            </div>
          }
        >
          {provenance.root.store_id ? `Store ${provenance.root.store_id}` : provenance.root.source}
        </InformationBadge>
        <InformationBadge
          ariaLabel={`${references.length} observed References, ${referenceCounts.errors} errors, ${referenceCounts.warnings} warnings`}
          tooltip={formatReferenceSummary(references.length, referenceCounts)}
          tone={referenceCounts.errors > 0 ? 'custom' : 'muted'}
          className={
            referenceCounts.errors > 0
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : undefined
          }
        >
          References {references.length}
        </InformationBadge>
      </div>

      {referenceErrors.length > 0 ? (
        <div className="text-destructive flex items-start gap-2 text-xs" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Reference errors:{' '}
            {referenceErrors.map(({ storeId, errors }) => `${storeId} (${errors})`).join(', ')}
          </span>
        </div>
      ) : null}

      <EvidenceDisclosure
        title="Paths and CLI evidence"
        summary={`${Object.keys(provenance.artifactPaths).length} artifacts · ${references.length} References`}
      >
        <div className="min-w-0 space-y-3">
          <ReadableChangeFacts provenance={provenance} />
          <EvidenceDisclosure
            title="Artifact outputs"
            summary={`${Object.keys(provenance.artifactPaths).length} outputs`}
            className="border-border/60"
          >
            <div className="min-w-0 space-y-3">
              <ArtifactOutputs artifactPaths={provenance.artifactPaths} />
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
          </EvidenceDisclosure>
          <EvidenceDisclosure
            title="References"
            summary={`${references.length} observed`}
            className="border-border/60"
          >
            <ReferenceEvidence references={references} />
          </EvidenceDisclosure>
          <EvidenceDisclosure
            title="CLI result"
            summary={`${provenance.evidence.command} · exit ${provenance.evidence.exitCode ?? 'unknown'}`}
            className="border-border/60"
          >
            <CliResultEvidence evidence={provenance.evidence} />
          </EvidenceDisclosure>
        </div>
      </EvidenceDisclosure>
    </section>
  )
}

function ReadableChangeFacts({
  provenance,
}: {
  provenance: Extract<ChangeStatus['provenance'], { kind: 'cli' }>
}) {
  return (
    <dl className="@[32rem]:grid-cols-[auto_minmax(0,1fr)] grid min-w-0 gap-x-3 gap-y-1">
      <dt className="text-muted-foreground">Change root</dt>
      <dd className="min-w-0 break-all font-mono">{provenance.changeRoot}</dd>
      <dt className="text-muted-foreground">Planning home</dt>
      <dd className="min-w-0 break-all font-mono">{provenance.planningHome.root}</dd>
      <dt className="text-muted-foreground">Root source</dt>
      <dd className="min-w-0 break-words">
        {provenance.root.source}
        {provenance.root.store_id ? ` · ${provenance.root.store_id}` : ''}
      </dd>
      <dt className="text-muted-foreground">Action context</dt>
      <dd className="min-w-0 break-words">
        {provenance.actionContext.mode} · {provenance.actionContext.sourceOfTruth}
      </dd>
    </dl>
  )
}

function ArtifactOutputs({
  artifactPaths,
}: {
  artifactPaths: Extract<ChangeStatus['provenance'], { kind: 'cli' }>['artifactPaths']
}) {
  return (
    <dl className="min-w-0 space-y-3">
      {Object.entries(artifactPaths).map(([artifactId, artifact]) => (
        <div key={artifactId} className="min-w-0">
          <dt className="font-medium">{artifactId}</dt>
          <dd className="text-muted-foreground min-w-0 break-all font-mono">
            {artifact.outputPath} {'->'} {artifact.resolvedOutputPath}
          </dd>
          <dd className="text-muted-foreground min-w-0 break-all">
            Existing:{' '}
            {artifact.existingOutputPaths.length > 0
              ? artifact.existingOutputPaths.join(', ')
              : 'none observed'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function CliResultEvidence({
  evidence,
}: {
  evidence: Extract<ChangeStatus['provenance'], { kind: 'cli' }>['evidence']
}) {
  return (
    <div className="min-w-0 space-y-3">
      <dl className="@[32rem]:grid-cols-[auto_minmax(0,1fr)] grid min-w-0 gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Command</dt>
        <dd className="min-w-0 break-all font-mono">{evidence.command}</dd>
        <dt className="text-muted-foreground">Exit</dt>
        <dd>{evidence.exitCode ?? 'unknown'}</dd>
        <dt className="text-muted-foreground">Selector</dt>
        <dd className="min-w-0 break-all">{evidence.selector.store ?? 'none'}</dd>
        <dt className="text-muted-foreground">Contract</dt>
        <dd className="min-w-0 break-words">{evidence.contractError ?? 'compatible'}</dd>
      </dl>
      <EvidenceDisclosure title="Raw CLI payload" summary="stdout · stderr · diagnostics">
        <pre className="bg-muted/40 max-h-48 max-w-full overflow-auto whitespace-pre-wrap break-all rounded p-2 font-mono">
          {JSON.stringify(
            {
              stdout: evidence.stdout,
              stderr: evidence.stderr,
              diagnostics: evidence.diagnostics,
              payload: evidence.payload,
            },
            null,
            2
          )}
        </pre>
      </EvidenceDisclosure>
    </div>
  )
}

function summarizeReferences(references: CliReferenceIndexEntry[]) {
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

function formatReferenceSummary(
  references: number,
  counts: ReturnType<typeof summarizeReferences>
): string {
  return `${references} References · ${counts.errors} errors · ${counts.warnings} warnings · ${counts.total} diagnostics`
}

function ReferenceEvidence({ references }: { references: CliReferenceIndexEntry[] }) {
  return (
    <div>
      <div className="font-medium">Observed References</div>
      {references.length === 0 ? (
        <div className="text-muted-foreground mt-1">No reference currently observed.</div>
      ) : (
        <div className="mt-1 space-y-2">
          {references.map((reference) => (
            <div key={reference.store_id}>
              <div className="font-mono">{reference.store_id}</div>
              {reference.status.length === 0 ? (
                <div className="text-muted-foreground">No CLI diagnostic.</div>
              ) : (
                <ul className="text-muted-foreground space-y-0.5">
                  {reference.status.map((diagnostic) => (
                    <li key={`${diagnostic.severity}:${diagnostic.code}:${diagnostic.message}`}>
                      {diagnostic.severity} · {diagnostic.code} · {diagnostic.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
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
