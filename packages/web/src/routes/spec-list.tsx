/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Default the project Spec Catalog to writable Owned Specs.
 * 2. Group direct read-only Referenced Specs by Store identity.
 * 3. Preserve compound routes, collision-safe View Transition identity, and local row continuity.
 * 4. Keep empty states source-specific without completeness claims.
 * 5. Surface transport failure without hiding retained Catalog truth or claiming source emptiness.
 *
 * Original request (2026-07-15): "Specs defaults to Owned and provides a Store-grouped Referenced view with immutable entries."
 */
import { SpecListSkeleton } from '@/components/realtime'
import { formatRelativeTime } from '@/lib/format-time'
import { useSpecsSubscription } from '@/lib/use-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import { getSharedElementBinding } from '@/lib/view-transitions/shared-elements'
import { useSpecListContinuity } from '@/routes/spec-list-continuity'
import { specIdentityKey, type SpecCatalogEntry } from '@openspecui/core/spec-catalog'
import { useLocation } from '@tanstack/react-router'
import { AlertCircle, ChevronRight, FileText, LockKeyhole } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

type SpecScope = 'owned' | 'referenced'

function readSpecListScopeState(state: unknown): SpecScope {
  if (typeof state !== 'object' || state == null) return 'owned'
  return (state as { __specListScope?: unknown }).__specListScope === 'referenced'
    ? 'referenced'
    : 'owned'
}

/** Render the owned-default and Store-grouped referenced Spec Catalog views. */
export function SpecList() {
  const location = useLocation()
  const { data: catalog, isLoading, error } = useSpecsSubscription()
  const [scope, setScope] = useState<SpecScope>(() => readSpecListScopeState(location.state))
  const owned = useMemo(
    () => catalog?.entries.filter((entry) => entry.identity.kind === 'owned') ?? [],
    [catalog]
  )
  const referencedByStore = useMemo(() => {
    const groups = new Map<string, SpecCatalogEntry[]>()
    for (const entry of catalog?.entries ?? []) {
      if (entry.identity.kind !== 'referenced') continue
      const entries = groups.get(entry.identity.storeId) ?? []
      entries.push(entry)
      groups.set(entry.identity.storeId, entries)
    }
    return (catalog?.referenceSources ?? [])
      .map((source) => ({ source, specs: groups.get(source.storeId) ?? [] }))
      .sort((left, right) => left.source.storeId.localeCompare(right.source.storeId))
  }, [catalog])
  const referencedCount = referencedByStore.reduce((total, { specs }) => total + specs.length, 0)
  const listRef = useRef<HTMLDivElement>(null)
  const scopeEntries = useMemo(
    () => (scope === 'owned' ? owned : referencedByStore.flatMap(({ specs }) => specs)),
    [owned, referencedByStore, scope]
  )
  const displayedSpecs = useSpecListContinuity(scopeEntries, scope, listRef)
  const displayedOwned = displayedSpecs?.filter((spec) => spec.identity.kind === 'owned') ?? []
  const displayedReferencedByStore = referencedByStore.map(({ source }) => ({
    source,
    specs:
      displayedSpecs?.filter(
        (spec) => spec.identity.kind === 'referenced' && spec.identity.storeId === source.storeId
      ) ?? [],
  }))
  const errorAlert = error ? (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">Spec Catalog subscription failed.</p>
        <p className="break-words">{error.message}</p>
      </div>
    </div>
  ) : null

  if (isLoading && !catalog && !error) {
    // Preserve page chrome and render a stable skeleton body rather than a full-tree barrier.
    return (
      <div className="space-y-6 p-4">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <FileText className="h-6 w-6 shrink-0" />
          Specifications
        </h1>
        <SpecListSkeleton count={5} />
      </div>
    )
  }

  if (!catalog && error) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <FileText className="h-6 w-6 shrink-0" />
          Specifications
        </h1>
        {errorAlert}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <FileText className="h-6 w-6 shrink-0" />
        Specifications
      </h1>

      {errorAlert}

      <div
        role="tablist"
        aria-label="Spec source"
        className="bg-muted border-border inline-grid min-h-9 grid-cols-2 rounded-md border p-0.5"
      >
        <ScopeButton
          scope="owned"
          current={scope}
          label="Owned"
          count={owned.length}
          onSelect={setScope}
        />
        <ScopeButton
          scope="referenced"
          current={scope}
          label="Referenced"
          count={referencedCount}
          onSelect={setScope}
        />
      </div>

      {scope === 'owned' ? (
        <div
          ref={listRef}
          data-spec-list-continuity
          className="border-border divide-border divide-y rounded-lg border"
        >
          {displayedOwned.map((spec) => (
            <SpecCatalogRow key={specIdentityKey(spec.identity)} spec={spec} />
          ))}
          {displayedOwned.length === 0 && !error ? (
            <div className="text-muted-foreground p-4 text-center">
              No Owned Specs found in the current Planning root.
            </div>
          ) : null}
        </div>
      ) : (
        <div
          ref={listRef}
          data-spec-list-continuity
          className="border-border divide-border divide-y rounded-lg border"
        >
          {displayedReferencedByStore.map(({ source, specs }) => (
            <section
              key={source.storeId}
              aria-labelledby={`reference-store-${encodeURIComponent(source.storeId)}`}
            >
              <div className="bg-muted/30 border-border flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
                <h2
                  id={`reference-store-${encodeURIComponent(source.storeId)}`}
                  className="min-w-0 truncate font-mono text-sm font-semibold"
                  title={source.storeId}
                >
                  {source.storeId}
                </h2>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>{specs.length} Specs</span>
                  <span className="inline-flex items-center gap-1">
                    <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                    Read-only
                  </span>
                </div>
              </div>
              {source.state === 'error' ? (
                <div role="alert" className="text-destructive space-y-1 px-4 py-3 text-sm">
                  <div>OpenSpec could not enumerate this observed Reference Store.</div>
                  <div>Exit status: {source.evidence.exitCode ?? 'unknown'}</div>
                  {source.evidence.contractError ? (
                    <div>{source.evidence.contractError}</div>
                  ) : null}
                  {source.evidence.stderr ? <div>{source.evidence.stderr}</div> : null}
                  {[...source.diagnostics, ...source.evidence.diagnostics].map(
                    (diagnostic, index) => (
                      <div key={`${diagnostic.code}:${index}`}>
                        {diagnostic.code}: {diagnostic.message}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="divide-border divide-y">
                  {specs.map((spec) => (
                    <SpecCatalogRow key={specIdentityKey(spec.identity)} spec={spec} />
                  ))}
                  {specs.length === 0 && !error ? (
                    <div className="text-muted-foreground px-4 py-3 text-sm">
                      OpenSpec reported no Specs for this Store.
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          ))}
          {referencedByStore.length === 0 && !error ? (
            <div className="text-muted-foreground p-4 text-center">
              No Referenced Specs currently observed.
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function ScopeButton({
  scope,
  current,
  label,
  count,
  onSelect,
}: {
  scope: SpecScope
  current: SpecScope
  label: string
  count: number
  onSelect: (scope: SpecScope) => void
}) {
  const selected = current === scope
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(scope)}
      className={`min-w-28 rounded px-3 py-1 text-sm font-medium transition-colors ${
        selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
      }`}
    >
      {label} <span className="tabular-nums">{count}</span>
    </button>
  )
}

function SpecCatalogRow({ spec }: { spec: SpecCatalogEntry }) {
  const identityKey = specIdentityKey(spec.identity)
  const sharedDescriptor = { family: 'specs', entityId: identityKey } as const
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <FileText
          {...getSharedElementBinding(sharedDescriptor, 'icon')}
          className="text-muted-foreground h-5 w-5 shrink-0"
        />
        <div className="min-w-0">
          <div
            {...getSharedElementBinding(sharedDescriptor, 'title')}
            className="truncate font-medium"
          >
            {spec.name}
          </div>
          <div className="text-muted-foreground truncate text-sm">
            {spec.identity.kind === 'referenced' && <>{spec.identity.storeId} · </>}
            {spec.identity.specId}
            {spec.updatedAt > 0 && <> · {formatRelativeTime(spec.updatedAt)}</>}
          </div>
          {spec.summary && (
            <div className="text-muted-foreground truncate text-sm">{spec.summary}</div>
          )}
          {spec.readOnly ? <span className="sr-only">Read-only Reference</span> : null}
        </div>
      </div>
      <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
    </>
  )
  const handoff = {
    family: 'specs',
    entityId: identityKey,
    title: spec.name,
    subtitle:
      spec.identity.kind === 'owned'
        ? spec.identity.specId
        : `${spec.identity.storeId} / ${spec.identity.specId}`,
  }
  const sharedProps = {
    vt: { sharedElements: sharedDescriptor },
    ...getSharedElementBinding(sharedDescriptor, 'container'),
    className: 'hover:bg-muted/50 flex items-center justify-between gap-3 p-4',
  }

  return spec.identity.kind === 'owned' ? (
    <VTLink
      to="/specs/owned/$specId"
      params={{ specId: spec.identity.specId }}
      state={(previous) => ({ ...previous, __vtHandoff: handoff })}
      {...sharedProps}
    >
      {content}
    </VTLink>
  ) : (
    <VTLink
      to="/specs/referenced/$storeId/$specId"
      params={{ storeId: spec.identity.storeId, specId: spec.identity.specId }}
      state={(previous) => ({ ...previous, __vtHandoff: handoff })}
      {...sharedProps}
    >
      {content}
    </VTLink>
  )
}
