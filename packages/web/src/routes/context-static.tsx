/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Render the static Context route from publication-safe snapshot provenance.
 * 2. Distinguish none, omitted, included, and legacy-unrecorded Reference policy.
 * 3. State unavailable runtime evidence explicitly without starting live transports.
 *
 * Owner acceptance feedback (2026-07-28): "Static 导出后的 /context 页面没数据。"
 */
import {
  selectStaticContextSnapshot,
  type StaticContextReferencePolicy,
} from '@/lib/static-context'
import { getInitialData } from '@/lib/static-mode'
import { useStaticSnapshot } from '@/ssg/static-data-context'
import { FileText, Network } from 'lucide-react'

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

      <p className="text-muted-foreground text-sm">
        Published planning-root provenance and Reference policy from this static snapshot.
      </p>

      {context ? (
        <div className="space-y-4">
          <section className="border-border grid gap-4 rounded-lg border p-4 lg:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <h2 className="text-sm font-semibold">Published planning root</h2>
              <p className="text-muted-foreground break-all text-sm">
                {context.root?.planningRootPath ?? 'No planning root path was published.'}
              </p>
              {context.root ? (
                <dl className="text-muted-foreground grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                  <dt>root source</dt>
                  <dd>{context.root.rootSource}</dd>
                  {context.root.storeId ? (
                    <>
                      <dt>store</dt>
                      <dd className="break-all">{context.root.storeId}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
            </div>
            <div className="min-w-0 space-y-2">
              <h2 className="text-sm font-semibold">Published project</h2>
              <p className="text-muted-foreground break-all text-sm">{context.projectName}</p>
              <dl className="text-muted-foreground grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                <dt>OpenSpecUI</dt>
                <dd>{context.version}</dd>
                <dt>observed at</dt>
                <dd>
                  {context.observedAt === null
                    ? 'Unavailable'
                    : new Date(context.observedAt).toISOString()}
                </dd>
              </dl>
            </div>
          </section>

          <StaticReferencePolicy policy={context.referencePolicy} />

          <section className="border-border space-y-2 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Static evidence boundary</h2>
            <p className="text-muted-foreground text-sm">
              Runtime CLI evidence, registry, and data scope are not published in static exports.
            </p>
            <p className="text-muted-foreground text-xs">
              This snapshot does not claim a live connection, current mutation authority, or current
              Reference health.
            </p>
          </section>
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
  return (
    <section className="border-border space-y-3 rounded-lg border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4" aria-hidden />
        Published References
      </h2>
      {policy.kind === 'none' ? (
        <p className="text-muted-foreground text-sm">
          No effective References were recorded when this snapshot was exported.
        </p>
      ) : policy.kind === 'omit' ? (
        <p className="text-muted-foreground text-sm">
          {policy.sourceCount} Reference sources were observed and omitted from this export. Their
          identities and content were not published.
        </p>
      ) : policy.kind === 'unrecorded' ? (
        <p className="text-muted-foreground text-sm">
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
    </section>
  )
}
