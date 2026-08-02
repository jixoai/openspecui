/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Project Schema entities as a catalog rather than dynamic Config-owner tabs.
 * 2. Preserve loading, retained-data errors, and current-empty conclusions inside catalog geometry.
 * 3. Route encoded Schema identity into one focused detail/editor page.
 *
 * Owner Config-workbench decision (2026-08-01): move Schemas to `/config/schemas` and `/config/schemas/:id`.
 * Original request (2026-08-01): "还得再调查，config页面存在很多不完善的设计。"
 */
import { ConfigOwnerHeader, ConfigWorkbenchPage } from '@/components/config/config-workbench'
import { DetailPanelSkeleton, RealtimeRevalidateCue } from '@/components/realtime'
import { useOpsxConfigBundleSubscription } from '@/lib/use-opsx'
import { VTLink } from '@/lib/view-transitions/navigation'
import { AlertCircle, ArrowRight, Boxes, PackageOpen } from 'lucide-react'

/** Live/static Schema catalog with route-owned entity navigation. */
export function ConfigSchemaCatalog() {
  const { data: bundle, isLoading, error } = useOpsxConfigBundleSubscription()
  const schemas = bundle?.schemas
  const initialLoading = schemas === undefined && isLoading && error === null
  const currentEmpty = schemas?.length === 0 && error === null

  return (
    <ConfigWorkbenchPage
      current="schemas"
      header={
        <ConfigOwnerHeader
          title="Schemas"
          description="Browse resolved OpenSpec workflow schemas, then open one focused detail workspace."
          icon={<Boxes className="h-6 w-6 shrink-0" aria-hidden />}
        />
      }
    >
      <div className="space-y-4" data-schema-catalog="true">
        {error ? (
          <div
            role="alert"
            className="text-destructive border-destructive/40 bg-destructive/10 flex items-start gap-2 rounded-lg border p-4 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Schema catalog refresh failed.</p>
              <p>{error.message}</p>
              {schemas !== undefined ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  Retaining the last successful catalog while the replacement observation is
                  unavailable.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {initialLoading ? (
          <section
            aria-label="Loading Schema catalog"
            className="border-border bg-card rounded-lg border p-4"
          >
            <DetailPanelSkeleton count={5} />
          </section>
        ) : null}

        {schemas && schemas.length > 0 ? (
          <RealtimeRevalidateCue active={isLoading}>
            <ul className="@[48rem]:grid-cols-2 grid gap-3">
              {schemas.map((schema) => (
                <li key={schema.name} className="min-w-0">
                  <VTLink
                    to={`/config/schemas/${encodeURIComponent(schema.name)}`}
                    className="border-border bg-card hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-primary flex min-h-32 min-w-0 flex-col justify-between gap-4 rounded-lg border p-4 outline-none focus-visible:ring-2"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <h2 className="min-w-0 truncate text-sm font-semibold">{schema.name}</h2>
                        <span className="bg-muted text-muted-foreground shrink-0 rounded px-2 py-0.5 text-[10px]">
                          {schema.source}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                        {schema.description || 'No schema description provided.'}
                      </p>
                    </div>
                    <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
                      <span>{schema.artifacts.length} artifacts</span>
                      <span className="text-foreground inline-flex items-center gap-1 font-medium">
                        Open
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </div>
                  </VTLink>
                </li>
              ))}
            </ul>
          </RealtimeRevalidateCue>
        ) : null}

        {currentEmpty ? (
          <section className="border-border bg-card text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm">
            <PackageOpen className="h-6 w-6" aria-hidden />
            <p>No schemas available.</p>
          </section>
        ) : null}
      </div>
    </ConfigWorkbenchPage>
  )
}
