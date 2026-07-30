/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Render the Store Detail direct plane: identity, usability, observed Usage, readonly content, lifecycle (7.8-7.10).
 * 2. Promote blocking diagnostics; keep repository/Git/raw evidence secondary (7.11).
 * 3. Destructive unregister/remove in an overflow/danger flow gated by authority + lifecycle (7.12).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-app-distribution › "Open Store Detail" / "Store Detail loads readonly content".
 *
 * Pure presentation composed by the Stores route; the caller supplies the projection + authority + callbacks.
 * Observed-only Usage never claims machine-wide completeness. Specs/Changes regions render independently.
 */
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { usageCompletenessLabel, type StoreDetailProjection } from '../lib/store-detail-projection'

export interface StoreDetailProps {
  projection: StoreDetailProjection
  /** Remove/unregister the Store (destructive; gated by projection.canRemove). */
  onRemove?: () => void
}

export function StoreDetail({ projection, onRemove }: StoreDetailProps) {
  return (
    <div className="@container min-w-0 space-y-6 p-4 md:p-6">
      {/* Direct plane: identity + health + authority (7.8). */}
      <header className="space-y-1">
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

      {/* Destructive remove (overflow/danger) gated by authority + lifecycle (7.12). */}
      {onRemove ? (
        <section className="space-y-1">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Danger zone
          </h2>
          <RemoveControl projection={projection} onRemove={onRemove} />
        </section>
      ) : null}
    </div>
  )
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
  renderEntries,
}: {
  state: 'loading' | 'ready' | 'error' | 'empty'
  error?: string
  renderEntries: () => React.ReactNode | undefined
}) {
  if (state === 'loading') return <p className="text-muted-foreground text-sm">Loading…</p>
  if (state === 'error')
    return <p className="text-destructive text-sm">{error ?? 'Failed to load.'}</p>
  if (state === 'empty') return <p className="text-muted-foreground text-sm">None observed.</p>
  return <ul className="space-y-1">{renderEntries()}</ul>
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

function RemoveControl({
  projection,
  onRemove,
}: {
  projection: StoreDetailProjection
  onRemove: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  if (!projection.canRemove) {
    return (
      <p className="text-muted-foreground text-xs">
        Remove requires current Environment authority, no running mutation, and no blocking
        diagnostics.
      </p>
    )
  }
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-muted-foreground hover:bg-muted hover:text-destructive inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-sm"
      >
        <Trash2 className="h-4 w-4" />
        Remove store
      </button>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-destructive text-sm">
        Unregister and remove this Store? The backend owns the lifecycle; this cannot be undone from
        here.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onRemove()
            setConfirming(false)
          }}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md px-3 py-1.5 text-sm font-medium"
        >
          Confirm remove
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="hover:bg-muted rounded-md px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
