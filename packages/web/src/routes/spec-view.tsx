/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Resolve owned and referenced Spec routes through compound identity.
 * 2. Render owned Markdown through the existing document pipeline.
 * 3. Render live CLI evidence and static snapshot conditions without synthesizing CLI or route-derived Store provenance.
 * 4. Preserve collision-safe View Transition identity across source-distinct documents.
 * 5. Retain successful detail content beside terminal document subscription errors.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 */
import { MarkdownViewer } from '@/components/markdown-viewer'
import { DetailPanelSkeleton } from '@/components/realtime'
import { resolveDocumentTranslationConfig } from '@/lib/resolve-document-translation-config'
import {
  useConfigSubscription,
  useGlobalSettingsSubscription,
  useSpecDocumentSubscription,
} from '@/lib/use-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import {
  getSharedElementBinding,
  readSharedElementHandoffState,
} from '@/lib/view-transitions/shared-elements'
import type { Spec } from '@openspecui/core'
import type { DocumentTranslationConfigInput } from '@openspecui/core/document-translation'
import {
  specIdentityFromRoute,
  specIdentityKey,
  type CliShowSpecDocument,
  type ReferencedSpecDocumentProjection,
  type SpecIdentity,
  type StaticReferencedSpecDocumentProjection,
} from '@openspecui/core/spec-catalog'
import { useLocation, useParams } from '@tanstack/react-router'
import { ArrowLeft, FileText, LockKeyhole } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { match, P } from 'ts-pattern'

export function SpecView() {
  const { specId, storeId } = useParams({ strict: false })
  const identity = useMemo(
    () => specIdentityFromRoute({ specId, ...(storeId ? { storeId } : {}) }),
    [specId, storeId]
  )
  const location = useLocation()
  const handoff = readSharedElementHandoffState(location.state)
  const { data: document, isLoading, error } = useSpecDocumentSubscription(identity)
  const { data: config } = useConfigSubscription()
  const { data: globalSettings } = useGlobalSettingsSubscription()
  const translationConfig = useMemo(
    () => resolveDocumentTranslationConfig(config?.translation, globalSettings),
    [config?.translation, globalSettings]
  )

  if (isLoading && !document) {
    return <SpecLoading identity={identity} title={handoff?.title} subtitle={handoff?.subtitle} />
  }

  if (error && (!document || document.state === 'not-found')) {
    return <SpecTransportErrorAlert message={error.message} />
  }

  if (!document || document.state === 'not-found') {
    return <div className="text-destructive p-4">Spec not found</div>
  }

  return document.source === 'owned' ? (
    <OwnedSpecContent
      identity={identity}
      spec={document.spec}
      rawMarkdown={document.rawMarkdown ?? ''}
      translationConfig={translationConfig}
      errorMessage={error?.message}
    />
  ) : (
    <ReferencedSpecContent document={document} errorMessage={error?.message} />
  )
}

function SpecTransportErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-4"
    >
      <span>Error loading spec: {message}</span>
    </div>
  )
}

function SpecLoading({
  identity,
  title,
  subtitle,
}: {
  identity: SpecIdentity
  title?: string
  subtitle?: string
}) {
  const sharedDescriptor = { family: 'specs', entityId: specIdentityKey(identity) } as const
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
      <SpecHeader
        identity={identity}
        title={title ?? identity.specId}
        subtitle={subtitle}
        sharedDescriptor={sharedDescriptor}
      />
      <div className="vt-detail-content rounded-lg border p-4" aria-busy="true">
        <DetailPanelSkeleton count={6} />
      </div>
    </div>
  )
}

function SpecHeader({
  identity,
  title,
  subtitle,
  sourceRef,
  sharedDescriptor,
}: {
  identity: SpecIdentity
  title: string
  subtitle?: string
  sourceRef?: React.RefObject<HTMLDivElement | null>
  sharedDescriptor: { family: 'specs'; entityId: string }
}) {
  const sourceLabel =
    subtitle ??
    (identity.kind === 'owned'
      ? `Owned · ${identity.specId}`
      : `Referenced from ${identity.storeId} · ${identity.specId}`)
  return (
    <div className="flex min-w-0 items-center gap-4">
      <VTLink
        to="/specs"
        state={(previous) => ({ ...previous, __specListScope: identity.kind })}
        vt={{ source: sourceRef, sharedElements: sharedDescriptor }}
        className="hover:bg-muted shrink-0 rounded-md p-2"
        aria-label="Back to specifications"
      >
        <ArrowLeft className="h-5 w-5" />
      </VTLink>
      <div
        ref={sourceRef}
        {...getSharedElementBinding(sharedDescriptor, 'container')}
        className="min-w-0"
      >
        <h1 className="font-nav flex min-w-0 items-center gap-2 text-2xl font-bold">
          <FileText
            {...getSharedElementBinding(sharedDescriptor, 'icon')}
            className="h-6 w-6 shrink-0"
          />
          <span {...getSharedElementBinding(sharedDescriptor, 'title')} className="truncate">
            {title}
          </span>
        </h1>
        <p className="text-muted-foreground truncate">{sourceLabel}</p>
      </div>
    </div>
  )
}

function OwnedSpecContent({
  identity,
  spec,
  rawMarkdown,
  translationConfig,
  errorMessage,
}: {
  identity: SpecIdentity
  spec: Spec | null
  rawMarkdown: string
  translationConfig?: DocumentTranslationConfigInput
  errorMessage?: string
}) {
  const headerRef = useRef<HTMLDivElement | null>(null)
  const sharedDescriptor = {
    family: 'specs',
    entityId: specIdentityKey(identity),
  } as const
  if (!spec) return <div className="text-destructive p-4">Spec not found</div>

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
      {errorMessage ? <SpecTransportErrorAlert message={errorMessage} /> : null}
      <SpecHeader
        identity={identity}
        title={spec.name}
        sourceRef={headerRef}
        sharedDescriptor={sharedDescriptor}
      />
      <MarkdownViewer
        markdown={rawMarkdown}
        path={`specs/${spec.id}/spec.md`}
        className="vt-detail-content min-h-0 flex-1"
        translationConfig={translationConfig}
      />
    </div>
  )
}

function ReferencedSpecContent({
  document,
  errorMessage,
}: {
  document: ReferencedSpecDocumentProjection
  errorMessage?: string
}) {
  const headerRef = useRef<HTMLDivElement | null>(null)
  const sharedDescriptor = {
    family: 'specs',
    entityId: specIdentityKey(document.identity),
  } as const
  const presentation = referencePresentation(document)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
      {errorMessage ? <SpecTransportErrorAlert message={errorMessage} /> : null}
      <SpecHeader
        identity={document.identity}
        title={document.upstream?.title ?? document.spec?.name ?? document.identity.specId}
        subtitle={presentation.subtitle}
        sourceRef={headerRef}
        sharedDescriptor={sharedDescriptor}
      />
      <div className="border-border bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden />
        <span>{presentation.readOnlyLabel}</span>
      </div>
      {document.state === 'ready' && document.provenance.kind === 'live' && document.upstream ? (
        <ReferencedSpecDocument document={document.upstream} />
      ) : document.state === 'ready' &&
        isStaticReferencedDocument(document) &&
        document.spec &&
        document.rawMarkdown ? (
        <MarkdownViewer
          markdown={document.rawMarkdown}
          path={`referenced:${document.identity.storeId}:specs/${document.identity.specId}/spec.md`}
          className="vt-detail-content min-h-0 flex-1"
        />
      ) : (
        <ReferencedSpecError document={document} />
      )}
    </div>
  )
}

function ReferencedSpecDocument({ document }: { document: CliShowSpecDocument }) {
  return (
    <article className="vt-detail-content min-h-0 flex-1 space-y-8 overflow-y-auto">
      {document.overview && (
        <section className="space-y-2">
          <h2 className="font-nav text-xl font-semibold">Overview</h2>
          <p className="whitespace-pre-wrap leading-7">{document.overview}</p>
        </section>
      )}
      <section className="space-y-5">
        <h2 className="font-nav text-xl font-semibold">Requirements</h2>
        {document.requirements.map((requirement, requirementIndex) => (
          <div
            key={`${requirementIndex}:${requirement.text}`}
            className="border-border space-y-4 border-l-2 pl-4"
          >
            <p className="whitespace-pre-wrap leading-7">{requirement.text}</p>
            {requirement.scenarios.map((scenario, scenarioIndex) => (
              <pre
                key={`${scenarioIndex}:${scenario.rawText}`}
                className="bg-muted overflow-x-auto whitespace-pre-wrap rounded-md p-3 text-sm"
              >
                {scenario.rawText}
              </pre>
            ))}
          </div>
        ))}
      </section>
    </article>
  )
}

function ReferencedSpecError({ document }: { document: ReferencedSpecDocumentProjection }) {
  if (isStaticReferencedDocument(document)) {
    return (
      <div className="border-destructive/40 bg-destructive/5 space-y-3 rounded-md border p-4">
        <h2 className="font-medium">{staticSnapshotErrorHeading(document.provenance)}</h2>
        <div className="text-muted-foreground text-sm">
          {staticSnapshotCondition(document.provenance)}
        </div>
      </div>
    )
  }
  const evidence = document.evidence
  return (
    <div className="border-destructive/40 bg-destructive/5 space-y-3 rounded-md border p-4">
      <h2 className="font-medium">OpenSpec could not project this Reference Spec.</h2>
      <div className="text-muted-foreground text-sm">
        Exit status: {evidence.exitCode ?? 'unknown'}
      </div>
      {evidence.contractError && (
        <pre className="whitespace-pre-wrap">{evidence.contractError}</pre>
      )}
      {evidence.stderr && <pre className="whitespace-pre-wrap">{evidence.stderr}</pre>}
      {evidence.diagnostics.map((diagnostic, index) => (
        <div key={`${diagnostic.code}:${index}`} className="text-sm">
          <span className="font-medium">{diagnostic.code}</span>: {diagnostic.message}
        </div>
      ))}
    </div>
  )
}

function isStaticReferencedDocument(
  document: ReferencedSpecDocumentProjection
): document is StaticReferencedSpecDocumentProjection {
  return document.provenance.kind === 'static'
}

function staticSnapshotCondition(
  provenance: StaticReferencedSpecDocumentProjection['provenance']
): string {
  return match(provenance)
    .with(
      { state: 'omitted' },
      ({ referenceSourceCount }) =>
        `Referenced content was omitted by the published snapshot policy (${referenceSourceCount} observed sources).`
    )
    .with({ state: 'none' }, () => 'The published snapshot records no effective Reference sources.')
    .with(
      { state: 'snapshot-unavailable' },
      () => 'Static Reference inventory is unavailable for this Referenced Spec request.'
    )
    .with(
      { state: P.union('missing', 'included'), source: P.not(P.nullish) },
      ({ source }) => `The published snapshot does not contain this Spec from ${source.storeId}.`
    )
    .with(
      { state: P.union('missing', 'included'), source: null },
      () => 'The published snapshot does not contain this Reference Spec.'
    )
    .exhaustive()
}

function staticSnapshotErrorHeading(
  provenance: StaticReferencedSpecDocumentProjection['provenance']
): string {
  return match(provenance)
    .with(
      { state: 'snapshot-unavailable' },
      () => 'Static Reference inventory cannot render this Referenced Spec request.'
    )
    .with(
      { state: P.union('included', 'missing', 'omitted', 'none') },
      () => 'Published static snapshot cannot render this Reference Spec.'
    )
    .exhaustive()
}

function referencePresentation(document: ReferencedSpecDocumentProjection): {
  subtitle: string
  readOnlyLabel: string
} {
  return match(document)
    .with({ provenance: { kind: 'live' } }, ({ identity }) => ({
      subtitle: `Referenced from ${identity.storeId} · ${identity.specId}`,
      readOnlyLabel: `Read-only Reference projected from OpenSpec Store ${identity.storeId}.`,
    }))
    .with(
      {
        provenance: {
          kind: 'static',
          state: P.union('included', 'missing'),
          source: P.not(P.nullish),
        },
      },
      ({ identity, provenance: { source } }) => ({
        subtitle: `Referenced from ${source.storeId} · ${identity.specId}`,
        readOnlyLabel: `Read-only Reference projected from OpenSpec Store ${source.storeId}.`,
      })
    )
    .with(
      {
        provenance: { kind: 'static', state: P.union('included', 'missing'), source: null },
      },
      ({ identity }) => staticReferenceRequestPresentation(identity.specId)
    )
    .with({ provenance: { kind: 'static', state: 'omitted' } }, ({ identity }) =>
      staticReferenceRequestPresentation(identity.specId)
    )
    .with({ provenance: { kind: 'static', state: 'none' } }, ({ identity }) =>
      staticReferenceRequestPresentation(identity.specId)
    )
    .with({ provenance: { kind: 'static', state: 'snapshot-unavailable' } }, ({ identity }) =>
      staticUnavailableReferenceRequestPresentation(identity.specId)
    )
    .exhaustive()
}

function staticReferenceRequestPresentation(specId: string): {
  subtitle: string
  readOnlyLabel: string
} {
  return {
    subtitle: `Referenced Spec request · ${specId}`,
    readOnlyLabel: 'Read-only Referenced Spec request from published static snapshot.',
  }
}

function staticUnavailableReferenceRequestPresentation(specId: string): {
  subtitle: string
  readOnlyLabel: string
} {
  return {
    subtitle: `Referenced Spec request · ${specId}`,
    readOnlyLabel: 'Read-only Referenced Spec request. Static Reference inventory is unavailable.',
  }
}
