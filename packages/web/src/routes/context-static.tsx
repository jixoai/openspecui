/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Render the static Context route from publication-safe snapshot provenance.
 * 2. Distinguish none, omitted, included, and legacy-unrecorded Reference policy.
 * 3. State unavailable runtime evidence explicitly without starting live transports.
 *
 * Owner acceptance feedback (2026-07-28): "Static 导出后的 /context 页面没数据。"
 * Original request (2026-07-28): static source facts stay attributable while verbose policy detail is disclosed on demand.
 */
import { EvidenceDisclosure, InformationBadge } from '@/components/information-disclosure'
import {
  selectStaticContextSnapshot,
  type StaticContextReferencePolicy,
} from '@/lib/static-context'
import { getInitialData } from '@/lib/static-mode'
import { useStaticSnapshot } from '@/ssg/static-data-context'
import { Network } from 'lucide-react'

/** Render only Context facts that were deliberately published in the static snapshot. */
export function StaticContextView() {
  const providedSnapshot = useStaticSnapshot()
  const context = selectStaticContextSnapshot(providedSnapshot ?? getInitialData())

  return (
    <div className="space-y-6 p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h1 className="font-nav flex min-w-0 items-center gap-2 text-2xl font-bold">
          <Network className="h-6 w-6 shrink-0" aria-hidden />
          Context
        </h1>
      </div>

      {context ? (
        <div className="space-y-4">
          <section className="border-border flex min-w-0 flex-wrap items-center gap-2 border-y py-3 text-xs">
            <span className="font-medium">Published planning root</span>
            <span className="min-w-0 flex-1 break-all font-mono text-sm">
              {context.root?.planningRootPath ?? 'No planning root path was published.'}
            </span>
            {context.root ? (
              <InformationBadge
                ariaLabel={`Published root source ${context.root.rootSource}`}
                tooltip={`Root source: ${context.root.rootSource}`}
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
              ariaLabel="Published project identity"
              tooltip={`${context.projectName} · OpenSpecUI ${context.version} · observed ${context.observedAt === null ? 'unavailable' : new Date(context.observedAt).toISOString()}`}
            >
              {context.projectName}
            </InformationBadge>
            <InformationBadge
              ariaLabel="Static Context evidence boundary"
              tooltip="Runtime CLI evidence, registry, and data scope are not published. This snapshot claims no live connection, mutation authority, or current Reference health."
            >
              Static snapshot
            </InformationBadge>
          </section>

          <StaticReferencePolicy policy={context.referencePolicy} />
        </div>
      ) : (
        <section className="border-border rounded-lg border p-4" role="status">
          <h2 className="text-sm font-semibold">Static Context unavailable</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            This export does not contain a readable snapshot.
          </p>
        </section>
      )}
    </div>
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
