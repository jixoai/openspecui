/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Default the project Spec Catalog to writable Owned Specs.
 * 2. Group direct read-only Referenced Specs by Store identity.
 * 3. Preserve compound routes and collision-safe View Transition identity.
 * 4. Keep empty states source-specific without completeness claims.
 *
 * Original request (2026-07-15): "Specs defaults to Owned and provides a Store-grouped Referenced view with immutable entries."
 */
import { formatRelativeTime } from '@/lib/format-time'
import { useSpecsSubscription } from '@/lib/use-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import { getSharedElementBinding } from '@/lib/view-transitions/shared-elements'
import { specIdentityKey, type SpecCatalogEntry } from '@openspecui/core/spec-catalog'
import { useLocation } from '@tanstack/react-router'
import { ChevronRight, FileText, LockKeyhole } from 'lucide-react'
import { useMemo, useState } from 'react'

type SpecScope = 'owned' | 'referenced'

function readSpecListScopeState(state: unknown): SpecScope {
  if (typeof state !== 'object' || state == null) return 'owned'
  return (state as { __specListScope?: unknown }).__specListScope === 'referenced'
    ? 'referenced'
    : 'owned'
}

export function SpecList() {
  const location = useLocation()
  const { data: catalog, isLoading } = useSpecsSubscription()
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
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
  }, [catalog])
  const referencedCount = referencedByStore.reduce(
    (total, [, entries]) => total + entries.length,
    0
  )

  if (isLoading && !catalog) {
    return <div className="route-loading animate-pulse">Loading specs...</div>
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <FileText className="h-6 w-6 shrink-0" />
        Specifications
      </h1>

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
        <div className="border-border divide-border divide-y rounded-lg border">
          {owned.map((spec) => (
            <SpecCatalogRow key={specIdentityKey(spec.identity)} spec={spec} />
          ))}
          {owned.length === 0 ? (
            <div className="text-muted-foreground p-4 text-center">
              No Owned Specs found in the current Planning root.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="border-border divide-border divide-y rounded-lg border">
          {referencedByStore.map(([storeId, specs]) => (
            <section
              key={storeId}
              aria-labelledby={`reference-store-${encodeURIComponent(storeId)}`}
            >
              <div className="bg-muted/30 border-border flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
                <h2
                  id={`reference-store-${encodeURIComponent(storeId)}`}
                  className="min-w-0 truncate font-mono text-sm font-semibold"
                  title={storeId}
                >
                  {storeId}
                </h2>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>{specs.length} Specs</span>
                  <span className="inline-flex items-center gap-1">
                    <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                    Read-only
                  </span>
                </div>
              </div>
              <div className="divide-border divide-y">
                {specs.map((spec) => (
                  <SpecCatalogRow key={specIdentityKey(spec.identity)} spec={spec} />
                ))}
              </div>
            </section>
          ))}
          {referencedByStore.length === 0 ? (
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
