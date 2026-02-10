import { MarkdownViewer } from '@/components/markdown-viewer'
import { Tabs, type Tab } from '@/components/tabs'
import type { Change } from '@openspecui/core'
import { FileText } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type DeltaSpec = NonNullable<Change['deltaSpecs']>[number]

function operationBadgeClass(operation: string) {
  switch (operation) {
    case 'ADDED':
      return 'border border-emerald-200 bg-emerald-100 text-emerald-700'
    case 'MODIFIED':
      return 'border border-amber-200 bg-amber-100 text-amber-800'
    case 'REMOVED':
      return 'border border-rose-200 bg-rose-100 text-rose-700'
    case 'RENAMED':
      return 'border border-sky-200 bg-sky-100 text-sky-700'
    default:
      return 'border border-muted bg-muted text-foreground'
  }
}

export function ChangeOverview({ change }: { change: Change }) {
  const deltaSpecs = change.deltaSpecs ?? []
  const [activeDeltaSpecId, setActiveDeltaSpecId] = useState(deltaSpecs[0]?.specId ?? '')

  // 当 deltaSpecs 变化时，确保 activeDeltaSpecId 有效
  useEffect(() => {
    if (!deltaSpecs.some((d) => d.specId === activeDeltaSpecId)) {
      setActiveDeltaSpecId(deltaSpecs[0]?.specId ?? '')
    }
  }, [deltaSpecs, activeDeltaSpecId])

  const affectedSpecs = useMemo<{ spec: string; operation: string }[]>(() => {
    const map = new Map<string, Set<string>>()
    change.deltas.forEach((delta) => {
      const set = map.get(delta.spec) ?? new Set<string>()
      set.add(delta.operation)
      map.set(delta.spec, set)
    })
    return Array.from(map.entries()).map(([spec, ops]) => ({
      spec,
      operation: ops.size === 1 ? Array.from(ops)[0] : 'MIXED',
    }))
  }, [change.deltas])

  return (
    <MarkdownViewer
      className="h-full"
      markdown={({ H1, Section }) => (
        <div className="space-y-6">
          {/* Why */}
          <Section>
            <H1 id="why">Why</H1>
            <div className="bg-muted/30 mt-2 rounded-lg p-4 [zoom:0.86]">
              <MarkdownViewer markdown={change.why} />
            </div>
          </Section>

          {/* What Changes */}
          <Section>
            <H1 id="what-changes">What Changes</H1>
            <div className="bg-muted/30 mt-2 rounded-lg p-4 [zoom:0.86]">
              <MarkdownViewer markdown={change.whatChanges} />
            </div>
          </Section>

          {/* Design */}
          {change.design && (
            <Section>
              <H1 id="design">Design</H1>
              <div className="bg-muted/30 mt-2 rounded-lg p-4 [zoom:0.86]">
                {/* 嵌套 MarkdownViewer，Section 会自动 +1 层级 */}
                <MarkdownViewer markdown={change.design} />
              </div>
            </Section>
          )}

          {/* Affected Specs */}
          {affectedSpecs.length > 0 && (
            <Section>
              <H1 id="affected-specs">Affected Specs ({affectedSpecs.length})</H1>
              <div className="divide-border border-border mt-3 divide-y rounded-lg border">
                {affectedSpecs.map(({ spec, operation }) => (
                  <div key={spec} className="flex items-center justify-between px-3 py-2">
                    <span className="font-medium">{spec}</span>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${operationBadgeClass(operation)}`}
                    >
                      {operation}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Delta Specs */}
          {deltaSpecs.length > 0 && (
            <Section>
              <H1 id="delta-specs">Delta Specs ({deltaSpecs.length})</H1>
              <div className="mt-2 [zoom:0.86]">
                <DeltaSpecTabs
                  deltaSpecs={deltaSpecs}
                  activeId={activeDeltaSpecId}
                  onActiveChange={setActiveDeltaSpecId}
                />
              </div>
            </Section>
          )}
        </div>
      )}
    />
  )
}

function DeltaSpecTabs({
  deltaSpecs,
  activeId,
  onActiveChange,
}: {
  deltaSpecs: DeltaSpec[]
  activeId: string
  onActiveChange: (id: string) => void
}) {
  if (deltaSpecs.length === 1) {
    const spec = deltaSpecs[0]
    return (
      <div className="bg-muted/20 rounded-lg p-4">
        <MarkdownViewer markdown={spec.content} />
      </div>
    )
  }

  const tabs: Tab[] = deltaSpecs.map((spec) => ({
    id: spec.specId,
    label: spec.specId,
    icon: <FileText className="h-4 w-4" />,
    content: (
      <div className="bg-muted/20 h-full rounded-lg p-4">
        <MarkdownViewer markdown={spec.content} />
      </div>
    ),
    unmountOnHide: true,
  }))

  return (
    <Tabs tabs={tabs} selectedTab={activeId} onTabChange={onActiveChange} className="min-h-80" />
  )
}
