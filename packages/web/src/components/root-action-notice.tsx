/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Render root-action loading and blocked states with CLI-owned evidence.
 * 2. Keep the notice reusable across OPSX compose and direct-action surfaces.
 *
 * Original request (2026-07-15): "Show CLI-owned failure evidence when root selection fails."
 */
import type { RootActionState } from '@/lib/use-root-action-state'
import { AlertCircle, Loader2 } from 'lucide-react'

export function RootActionNotice({ state }: { state: RootActionState }) {
  if (state.status === 'ready') return null
  const checking = state.status === 'checking'

  return (
    <div
      role={checking ? 'status' : 'alert'}
      aria-live={checking ? 'polite' : 'assertive'}
      className={
        checking
          ? 'border-border bg-muted/30 rounded-md border p-3 text-sm'
          : 'border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm'
      }
    >
      <div className="flex items-center gap-2 font-medium">
        {checking ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <AlertCircle className="h-4 w-4" aria-hidden />
        )}
        {state.title}
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words">{state.message}</p>
      {state.evidence.length > 0 ? (
        <ul className="mt-2 space-y-1 font-mono text-xs">
          {state.evidence.map((line) => (
            <li key={line} className="whitespace-pre-wrap break-all">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
