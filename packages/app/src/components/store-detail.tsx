/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Render the Store Detail direct plane: identity, usability, observed Usage, readonly content, lifecycle (7.8-7.10).
 * 2. Promote blocking diagnostics; keep repository/Git/raw evidence secondary (7.11).
 * 3. Launch route-owned unregister/remove dialogs only when authority and lifecycle permit them (7.12).
 * 4. Preserve retained content while showing regional refresh and failure evidence.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-app-distribution › "Open Store Detail" / "Store Detail loads readonly content".
 *
 * Pure presentation composed by the Stores route; the caller supplies the projection + authority + callbacks.
 * Observed-only Usage never claims machine-wide completeness. Specs/Changes regions render independently.
 */
import { ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, Trash2, Unlink2 } from 'lucide-react'
import { useState } from 'react'
import { usageCompletenessLabel, type StoreDetailProjection } from '../lib/store-detail-projection'

export interface StoreDetailProps {
  projection: StoreDetailProjection
  /** Open the route-owned registry-only unregister confirmation dialog. */
  onUnregister?: () => void
  /** Open the route-owned destructive checkout removal confirmation dialog. */
  onRemove?: () => void
  onBack?: () => void
}

export function StoreDetail({ projection, onUnregister, onRemove, onBack }: StoreDetailProps) {
  return (
    <div className="@container min-w-0 space-y-6 p-4 md:p-6">
      {/* Direct plane: identity + health + authority (7.8). */}
      <header className="space-y-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Stores
          </button>
        ) : null}
        <h1 className="font-nav text-2xl font-bold">{projection.identity.storeId}</h1>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <HealthBadge health={projection.health} />
          <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
            {projection.identity.envUri}
          </span>
          {!projection.hasAuthority ? (
            <span className="text-xs text-amber-600">No current Environment authority</span>
          ) : null}
        </div>
      </header>

      {/* Blocking diagnostics promoted to the direct plane (7.11). */}
      {projection.hasBlockingDiagnostics ? (
        <section className="border-destructive/40 bg-destructive/5 space-y-1 rounded-md border p-3">
          {projection.blockingDiagnostics.map((diagnostic, index) => (
            <p key={index} className="text-destructive text-sm">
              {diagnostic.message}
            </p>
          ))}
        </section>
      ) : null}

      {/* Mutation failure direct (7.5). */}
      {projection.mutationError ? (
        <p className="text-destructive text-sm">{projection.mutationError}</p>
      ) : null}

      {/* Observed-only Usage (7.9). */}
      <section className="space-y-1">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Usage
        </h2>
        <p className="text-muted-foreground text-sm">{usageCompletenessLabel(projection)}</p>
        {projection.usage.length > 0 ? (
          <ul className="text-muted-foreground space-y-0.5 text-sm">
            {projection.usage.map((entry) => (
              <li key={`${entry.kind}-${entry.sourceId}`}>
                {entry.kind === 'root-for' ? 'Root for' : 'Referenced by'}:{' '}
                {entry.label ?? entry.sourceId}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Readonly Specs region (independent) (7.10). */}
      <section className="space-y-1">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Specs
        </h2>
        <ContentRegion
          state={projection.specs.state}
          error={projection.specs.error}
          refreshing={projection.specs.refreshing}
          renderEntries={() =>
            projection.specs.entries?.map((spec) => (
              <li key={spec.id} className="text-muted-foreground flex justify-between text-sm">
                <span>{spec.id}</span>
                <span>{spec.requirementCount} requirements</span>
              </li>
            ))
          }
        />
      </section>

      {/* Readonly active Changes region (independent) (7.10). */}
      <section className="space-y-1">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Active Changes
        </h2>
        <ContentRegion
          state={projection.changes.state}
          error={projection.changes.error}
          refreshing={projection.changes.refreshing}
          renderEntries={() =>
            projection.changes.entries?.map((change) => (
              <li key={change.name} className="text-muted-foreground text-sm">
                <div className="flex justify-between">
                  <span>{change.name}</span>
                  <span>
                    {change.completedTasks}/{change.totalTasks} tasks · {change.status}
                  </span>
                </div>
                <span className="text-xs">Last modified: {change.lastModified}</span>
              </li>
            ))
          }
        />
      </section>

      {/* Secondary repository evidence (collapsed) (7.11). */}
      <DisclosureSection title="Repository">
        <dl className="text-muted-foreground space-y-1 text-sm">
          {projection.repository.root ? (
            <div>
              <dt className="text-xs uppercase">Root</dt>
              <dd className="font-mono text-xs">{projection.repository.root}</dd>
            </div>
          ) : null}
          {projection.repository.metadataPath ? (
            <div>
              <dt className="text-xs uppercase">Metadata</dt>
              <dd className="font-mono text-xs">{projection.repository.metadataPath}</dd>
            </div>
          ) : null}
          {projection.repository.gitRemote !== undefined ? (
            <div>
              <dt className="text-xs uppercase">Git remote</dt>
              <dd className="font-mono text-xs">{projection.repository.gitRemote ?? 'none'}</dd>
            </div>
          ) : null}
        </dl>
      </DisclosureSection>

      {projection.evidence !== undefined && projection.evidence !== null ? (
        <DisclosureSection title="CLI evidence">
          <pre className="bg-muted/40 max-w-full overflow-hidden whitespace-pre-wrap break-words rounded-md p-3 text-xs">
            {formatEvidence(projection.evidence)}
          </pre>
        </DisclosureSection>
      ) : null}

      {/* Registry cleanup is distinct from destructive checkout removal (7.12). */}
      {onUnregister || onRemove ? (
        <section className="space-y-1">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Danger zone
          </h2>
          <CleanupControls
            projection={projection}
            onUnregister={onUnregister}
            onRemove={onRemove}
          />
        </section>
      ) : null}
    </div>
  )
}

function formatEvidence(evidence: unknown): string {
  try {
    return JSON.stringify(evidence, null, 2) ?? String(evidence)
  } catch {
    return 'CLI evidence could not be rendered.'
  }
}

function HealthBadge({ health }: { health: StoreDetailProjection['health'] }) {
  const variant =
    health === 'healthy'
      ? 'bg-emerald-500/15 text-emerald-700'
      : health === 'unhealthy'
        ? 'bg-red-500/15 text-red-700'
        : 'bg-muted text-muted-foreground'
  return <span className={`rounded px-2 py-0.5 text-xs capitalize ${variant}`}>{health}</span>
}

function ContentRegion({
  state,
  error,
  refreshing,
  renderEntries,
}: {
  state: 'loading' | 'ready' | 'error' | 'empty'
  error?: string
  refreshing?: boolean
  renderEntries: () => React.ReactNode | undefined
}) {
  if (state === 'loading') {
    return (
      <div aria-label="Loading content" className="flex items-center gap-2 py-1">
        <LoaderCircle className="text-muted-foreground h-4 w-4 animate-spin" />
        <span className="bg-muted h-3 w-32 animate-pulse rounded" />
      </div>
    )
  }
  if (state === 'error')
    return <p className="text-destructive text-sm">{error ?? 'Failed to load.'}</p>
  return (
    <div className="space-y-1">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {refreshing ? (
        <LoaderCircle
          aria-label="Refreshing content"
          className="text-muted-foreground h-3.5 w-3.5 animate-spin"
        />
      ) : null}
      {state === 'empty' ? (
        <p className="text-muted-foreground text-sm">None observed.</p>
      ) : (
        <ul className="space-y-1">{renderEntries()}</ul>
      )}
    </div>
  )
}

function DisclosureSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open ? <div className="mt-2 space-y-2">{children}</div> : null}
    </div>
  )
}

function CleanupControls({
  projection,
  onUnregister,
  onRemove,
}: {
  projection: StoreDetailProjection
  onUnregister?: () => void
  onRemove?: () => void
}) {
  if (!projection.canCleanUp) {
    return (
      <p className="text-muted-foreground text-xs">
        Store cleanup requires current Environment authority and no unsettled mutation.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onUnregister ? (
        <button
          type="button"
          onClick={onUnregister}
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
        >
          <Unlink2 className="h-4 w-4" />
          Unregister store
        </button>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:bg-muted hover:text-destructive inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-sm"
        >
          <Trash2 className="h-4 w-4" />
          Remove store files
        </button>
      ) : null}
    </div>
  )
}
