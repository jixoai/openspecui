/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Render Config-owned static Resolved Context from publication-safe snapshot provenance.
 * 2. Distinguish none, omitted, included, and legacy-unrecorded Reference policy.
 * 3. State unavailable runtime evidence explicitly without starting live transports.
 * 4. Participate in the publication-safe Config-local route and scroll contract.
 *
 * Owner acceptance feedback (2026-07-28): "Static 导出后的 /context 页面没数据。"
 * Original request (2026-07-28): static source facts stay attributable while verbose policy detail is disclosed on demand.
 * Owner Context direction (2026-07-29): move static Context to `/config/context` with a direct Config return.
 */
import { ConfigWorkbenchPage } from '@/components/config/config-workbench'
import { ResolvedContextHeader } from '@/components/config/resolved-context-header'
import { EvidenceDisclosure, InformationBadge } from '@/components/information-disclosure'
import {
  selectStaticContextSnapshot,
  type StaticContextReferencePolicy,
} from '@/lib/static-context'
import { getInitialData } from '@/lib/static-mode'
import { useStaticSnapshot } from '@/ssg/static-data-context'

/** Render only Context facts that were deliberately published in the static snapshot. */
export function StaticContextView() {
  const providedSnapshot = useStaticSnapshot()
  const context = selectStaticContextSnapshot(providedSnapshot ?? getInitialData())

  return (
    <ConfigWorkbenchPage current="context" header={<ResolvedContextHeader status="static" />}>
      {context ? (
        <div className="space-y-4">
          <section className="border-border min-w-0 border-y py-3">
            <div className="flex min-w-0 flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-muted-foreground text-xs">Published effective root</div>
                <div className="mt-1 min-w-0 break-all font-mono text-sm font-medium">
                  {context.root?.planningRootPath ?? 'No planning root path was published.'}
                </div>
              </div>
              {context.root ? (
                <InformationBadge
                  ariaLabel={`Published root source ${context.root.rootSource}`}
                  tooltip={`OpenSpec reported root source ${context.root.rootSource} at export time.`}
                >
                  {context.root.rootSource}
                </InformationBadge>
              ) : null}
              {context.root?.storeId ? (
                <InformationBadge
                  ariaLabel={`Published Store ${context.root.storeId}`}
                  tooltip={`The exported Planning root used Store ${context.root.storeId}.`}
                >
                  Store {context.root.storeId}
                </InformationBadge>
              ) : null}
              <InformationBadge
                ariaLabel="Static Context evidence boundary"
                tooltip="Only publication-safe facts are available; this snapshot has no live authority."
              >
                Published facts
              </InformationBadge>
            </div>
          </section>

          <StaticReferencePolicy policy={context.referencePolicy} />

          <EvidenceDisclosure
            title="Publication details"
            summary={`${context.projectName} · OpenSpecUI ${context.version}`}
          >
            <dl className="text-muted-foreground grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              <dt>project</dt>
              <dd className="break-words">{context.projectName}</dd>
              <dt>OpenSpecUI version</dt>
              <dd>{context.version}</dd>
              <dt>observed at</dt>
              <dd>
                {context.observedAt === null
                  ? 'unavailable'
                  : new Date(context.observedAt).toISOString()}
              </dd>
            </dl>
            <p className="text-muted-foreground mt-3 break-words">
              Runtime CLI evidence, registry, and data scope are not published. This snapshot claims
              no live connection, mutation authority, or current Reference health.
            </p>
          </EvidenceDisclosure>
        </div>
      ) : (
        <section className="border-border rounded-lg border p-4" role="status">
          <h2 className="text-sm font-semibold">Static Context unavailable</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            This export does not contain a readable snapshot.
          </p>
        </section>
      )}
    </ConfigWorkbenchPage>
  )
}

function StaticReferencePolicy({ policy }: { policy: StaticContextReferencePolicy }) {
  const summary =
    policy.kind === 'none'
      ? 'None recorded'
      : policy.kind === 'omit'
        ? `${policy.sourceCount} omitted`
        : policy.kind === 'unrecorded'
          ? 'Legacy unrecorded'
          : `${policy.sources.length} included`

  return (
    <EvidenceDisclosure title="Published Reference policy" summary={summary}>
      {policy.kind === 'none' ? (
        <p className="text-muted-foreground">
          No effective References were recorded when this snapshot was exported.
        </p>
      ) : policy.kind === 'omit' ? (
        <p className="text-muted-foreground">
          {policy.sourceCount} Reference sources were observed and omitted from this export. Their
          identities and content were not published.
        </p>
      ) : policy.kind === 'unrecorded' ? (
        <p className="text-muted-foreground">
          This snapshot predates the explicit Reference export policy.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {policy.sources.map((source) => (
            <li
              key={source.storeId}
              className="flex min-w-0 items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span className="min-w-0 break-all font-mono text-sm">{source.storeId}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {source.specCount} published Specs · export state {source.state}
              </span>
            </li>
          ))}
        </ul>
      )}
    </EvidenceDisclosure>
  )
}
