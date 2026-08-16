/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Render root-action blocked states with CLI-owned evidence as direct alerts.
 * 2. Render root-action checking states as one inline shiny badge for header/status rows.
 * 3. Keep blocker meaning direct while placing verbose CLI evidence in shared indirect space.
 * 4. Keep the notice reusable across OPSX compose and direct-action surfaces.
 *
 * Original request (2026-07-15): "Show CLI-owned failure evidence when root selection fails."
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.
 * Original request (2026-08-15): 刷新/解析中的块级 Alert 改为 Animated Shiny Text + Tooltip。
 */
import { EvidenceDisclosure } from '@/components/information-disclosure'
import { ShinyStatusBadge } from '@/components/realtime'
import type { RootActionState } from '@/lib/use-root-action-state'
import { AlertCircle } from 'lucide-react'

/**
 * Normal lifecycle (resolving/refreshing) as visual language — one inline shiny badge
 * with no layout block. The complete lock reason stays available on hover/keyboard
 * focus via the Tooltip and the hidden polite live region.
 */
export function RootCheckingBadge({ state }: { state: RootActionState }) {
  if (state.status !== 'checking') return null
  return <ShinyStatusBadge label={state.title} message={state.message} />
}

/** Render objective failure evidence that locks root-dependent actions; null otherwise. */
export function RootActionNotice({ state }: { state: RootActionState }) {
  if (state.status !== 'blocked') return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
    >
      <div className="flex items-center gap-2 font-medium">
        <AlertCircle className="h-4 w-4" aria-hidden />
        {state.title}
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words">{state.message}</p>
      {state.evidence.length > 0 ? (
        <EvidenceDisclosure
          title="Root command evidence"
          summary={`${state.evidence.length} ${state.evidence.length === 1 ? 'entry' : 'entries'}`}
          className="border-current/20 bg-background/35 mt-2"
        >
          <ul className="space-y-1 font-mono text-xs">
            {state.evidence.map((line) => (
              <li key={line} className="whitespace-pre-wrap break-all">
                {line}
              </li>
            ))}
          </ul>
        </EvidenceDisclosure>
      ) : null}
    </div>
  )
}
