/**
 * Orthogonal intents (created 2026-09-04 Asia/Shanghai):
 * 1. One header contract for every Evidence detail layer.
 * 2. Keep the layer title visually dominant over the layer body.
 * 3. Carry house-standard vertical padding so no detail plane reads body-first.
 *
 * Owner walkthrough correction (2026-09-04): all detail headers rendered smaller than their
 * bodies with non-standard padding; this shared contract replaces each layer's local header.
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */
import type { ReactNode } from 'react'

export function EvidenceLayerHeader({ title, summary }: { title: ReactNode; summary?: ReactNode }) {
  return (
    <header className="border-border mb-4 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b py-2.5">
      <h3 className="min-w-0 text-sm font-semibold tracking-tight">{title}</h3>
      {summary ? (
        <span className="text-muted-foreground min-w-0 text-[11px]">{summary}</span>
      ) : null}
    </header>
  )
}
