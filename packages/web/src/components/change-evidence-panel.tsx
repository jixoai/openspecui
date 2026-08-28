/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Render complete source-attributed Change paths, action context, and CLI evidence.
 * 2. Expose the former stacked panel as two list-addressable Evidence workspace sections:
 *    summary/paths first and CLI result (with the raw payload disclosure) last.
 * 3. Preserve layered Artifact, Reference, CLI-result, and raw-payload disclosure and the
 *    explicit static/unavailable presentation; the workspace detail pane owns scrolling.
 *
 * Original request (2026-08-03): use an Evidence tab to carry complete Change Detail information.
 * Original request (2026-08-28): "使用移动端的 list-detail 思维……分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
 */
import { EvidenceDisclosure } from '@/components/information-disclosure'
import type { ChangeStatus, CliReferenceIndexEntry } from '@openspecui/core'
import type { ReactNode } from 'react'
import type { ChangeReferenceEvidence } from './change-context-summary'

/** Shared section frame for the Evidence workspace detail pane; keeps the a11y heading. */
function WorkspaceSection({
  id,
  title,
  summary,
  children,
  container = false,
}: {
  id: string
  title: string
  summary?: ReactNode
  children: ReactNode
  container?: boolean
}) {
  return (
    <section
      data-evidence-section={id}
      aria-label={title}
      className={container ? '@container min-w-0' : 'min-w-0'}
    >
      <header className="border-border/60 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b pb-2">
        <h3 className="min-w-0 text-xs font-semibold">{title}</h3>
        {summary ? (
          <span className="text-muted-foreground min-w-0 text-[11px]">{summary}</span>
        ) : null}
      </header>
      <div className="min-w-0 pt-3 text-xs">{children}</div>
    </section>
  )
}

/** Readable paths/facts plus the layered Artifact and Reference disclosures (first row). */
export function ChangeSummaryPathsSection({
  status,
  referenceEvidence,
}: {
  status: ChangeStatus
  referenceEvidence: ChangeReferenceEvidence
}) {
  const provenance = status.provenance

  if (provenance.kind === 'static') {
    const artifactCount = status.artifacts.length
    return (
      <WorkspaceSection id="summary-paths" title="Summary & paths">
        <div className="space-y-3">
          <div className="border-border bg-muted/20 text-muted-foreground rounded-md border p-4 text-sm">
            CLI Change context and Reference evidence are unavailable in this static snapshot.
          </div>
          <EvidenceDisclosure
            title="Artifact outputs"
            summary={`${artifactCount} ${artifactCount === 1 ? 'output' : 'outputs'}`}
          >
            <StaticArtifactOutputs artifacts={status.artifacts} />
          </EvidenceDisclosure>
        </div>
      </WorkspaceSection>
    )
  }

  const artifactCount = Object.keys(provenance.artifactPaths).length

  return (
    <WorkspaceSection id="summary-paths" title="Summary & paths" container>
      <div className="min-w-0 space-y-3">
        <ReadableChangeFacts provenance={provenance} />
        <EvidenceDisclosure
          title="Artifact outputs"
          summary={`${artifactCount} ${artifactCount === 1 ? 'output' : 'outputs'}`}
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
        <EvidenceDisclosure title="References" summary={referenceSummary(referenceEvidence)}>
          <ReferenceEvidence evidence={referenceEvidence} />
        </EvidenceDisclosure>
      </div>
    </WorkspaceSection>
  )
}

/** CLI result with the raw payload disclosure (last row; live CLI provenance only). */
export function ChangeCliResultSection({ status }: { status: ChangeStatus }) {
  if (status.provenance.kind === 'static') return null
  const provenance = status.provenance

  return (
    <WorkspaceSection
      id="cli-result"
      title="CLI result"
      summary={`${provenance.evidence.command} · exit ${provenance.evidence.exitCode ?? 'unknown'}`}
    >
      <CliResultEvidence evidence={provenance.evidence} />
    </WorkspaceSection>
  )
}

function StaticArtifactOutputs({ artifacts }: { artifacts: ChangeStatus['artifacts'] }) {
  if (artifacts.length === 0) {
    return <p className="text-muted-foreground">No artifact output currently published.</p>
  }

  return (
    <dl className="min-w-0 space-y-3">
      {artifacts.map((artifact) => (
        <div key={artifact.id} className="min-w-0">
          <dt className="font-medium">{artifact.id}</dt>
          <dd className="text-muted-foreground min-w-0 break-all font-mono">
            {artifact.outputPath}
          </dd>
        </div>
      ))}
    </dl>
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

function referenceSummary(evidence: ChangeReferenceEvidence): string {
  if (evidence.state === 'unavailable') return 'Unavailable'
  return `${evidence.references.length} observed · ${evidence.state}`
}

function ReferenceEvidence({ evidence }: { evidence: ChangeReferenceEvidence }) {
  if (evidence.state === 'unavailable') {
    return (
      <p className="text-muted-foreground">
        {evidence.reason === 'static'
          ? 'Reference evidence is not published in this static snapshot.'
          : 'Reference evidence is unavailable until Root Context is observed.'}
      </p>
    )
  }

  const references = evidence.references
  return (
    <div>
      <div className="font-medium">
        {evidence.state === 'retained' ? 'Retained References' : 'Observed References'}
      </div>
      {references.length === 0 ? (
        <div className="text-muted-foreground mt-1">No reference currently observed.</div>
      ) : (
        <div className="mt-1 space-y-2">
          {references.map((reference) => (
            <ReferenceEntry key={reference.store_id} reference={reference} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReferenceEntry({ reference }: { reference: CliReferenceIndexEntry }) {
  return (
    <div className="min-w-0">
      <div className="min-w-0 break-all font-mono">{reference.store_id}</div>
      {reference.status.length === 0 ? (
        <div className="text-muted-foreground">No CLI diagnostic.</div>
      ) : (
        <ul className="text-muted-foreground space-y-0.5">
          {reference.status.map((diagnostic) => (
            <li
              key={`${diagnostic.severity}:${diagnostic.code}:${diagnostic.message}`}
              className="break-words"
            >
              {diagnostic.severity} · {diagnostic.code} · {diagnostic.message}
            </li>
          ))}
        </ul>
      )}
    </div>
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

function EvidenceList({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <div className="min-w-0">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground min-w-0 break-all">
        {values.length > 0 ? values.join(', ') : 'none observed'}
      </div>
    </div>
  )
}
