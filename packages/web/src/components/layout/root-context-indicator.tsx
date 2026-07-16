/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Keep launch-project and active planning-root identity visible in the global shell.
 * 2. Preserve loading, refreshing, stale, and error status without unlocking root actions.
 * 3. Link to the full project Context projection without introducing a root switcher.
 *
 * Original request (2026-07-15): "One project backend has one launch project and one CLI-selected writable planning root."
 */
import { isStaticMode } from '@/lib/static-mode'
import { selectRootContextSnapshot, useContextSubscription } from '@/lib/use-context-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import { AlertCircle, Folder, GitBranch, RefreshCw } from 'lucide-react'
import { Tooltip } from '../tooltip'

/** Compact shell projection for launch-project and active Planning-root identity. */
export interface RootContextIndicatorProps {
  variant: 'sidebar' | 'mobile'
  collapsed?: boolean
  fallbackLabel?: string
  onNavigate?: () => void
}

function pathName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).at(-1) || path
}

/** Global shell projection of launch and planning identities. */
export function RootContextIndicator({
  variant,
  collapsed = false,
  fallbackLabel = 'OpenSpec',
  onNavigate,
}: RootContextIndicatorProps) {
  const { data: projection, isLoading, error: transportError } = useContextSubscription()
  const context = selectRootContextSnapshot(projection)
  const staticMode = isStaticMode()

  if (staticMode) {
    return variant === 'mobile' ? (
      <span className="font-nav truncate text-[12px] tracking-[0.04em]">{fallbackLabel}</span>
    ) : null
  }

  const launchLabel = context ? pathName(context.launchProject.path) : fallbackLabel
  const planningLabel = context?.planningRoot ? pathName(context.planningRoot.path) : 'Resolving'
  const refreshing = projection?.state === 'refreshing'
  const failed = transportError !== null || projection?.state === 'error'
  const accessibleLabel = `Open Root Context. Launch: ${launchLabel}. Planning: ${planningLabel}.`
  const tooltip = `Launch: ${launchLabel} · Planning: ${planningLabel}`

  if (variant === 'mobile') {
    return (
      <VTLink
        to="/context"
        onClick={onNavigate}
        aria-label={accessibleLabel}
        className="hover:bg-muted flex min-w-0 max-w-[min(52vw,18rem)] items-center gap-2 rounded-md px-1.5 py-1"
      >
        <RootStateIcon refreshing={refreshing || (isLoading && !context)} failed={failed} />
        <span className="leading-3.5 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-1 text-[10px]">
          <span className="text-muted-foreground">Launch</span>
          <span className="truncate" title={context?.launchProject.path}>
            {launchLabel}
          </span>
          <span className="text-muted-foreground">Planning</span>
          <span className="truncate" title={context?.planningRoot?.path}>
            {planningLabel}
          </span>
        </span>
      </VTLink>
    )
  }

  if (collapsed) {
    return (
      <Tooltip content={tooltip} sideOffset={12}>
        <VTLink
          to="/context"
          onClick={onNavigate}
          aria-label={accessibleLabel}
          className="hover:bg-muted text-muted-foreground hover:text-foreground mb-4 flex h-8 w-8 items-center justify-center rounded-md"
        >
          <RootStateIcon refreshing={refreshing || (isLoading && !context)} failed={failed} />
        </VTLink>
      </Tooltip>
    )
  }

  return (
    <VTLink
      to="/context"
      onClick={onNavigate}
      aria-label={accessibleLabel}
      className="border-border hover:bg-muted/70 mb-4 block min-w-0 border-y py-2"
    >
      <span className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1 text-xs">
        <Folder className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
        <span className="text-muted-foreground">Launch</span>
        <span className="truncate font-medium" title={context?.launchProject.path}>
          {launchLabel}
        </span>
        <GitBranch className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
        <span className="text-muted-foreground">Planning</span>
        <span
          className="flex min-w-0 items-center gap-1 font-medium"
          title={context?.planningRoot?.path}
        >
          <span className="truncate">{planningLabel}</span>
          <RootStateIcon refreshing={refreshing || (isLoading && !context)} failed={failed} />
        </span>
      </span>
      {context?.planningRoot ? (
        <span className="text-muted-foreground mt-1 block truncate pl-5 text-[10px]">
          {context.planningRoot.source}
          {context.storeId ? ` · ${context.storeId}` : ''}
        </span>
      ) : null}
    </VTLink>
  )
}

function RootStateIcon({ refreshing, failed }: { refreshing: boolean; failed: boolean }) {
  if (refreshing) {
    return (
      <RefreshCw className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
    )
  }
  if (failed) {
    return <AlertCircle className="text-destructive h-3.5 w-3.5 shrink-0" aria-hidden />
  }
  return <GitBranch className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
}
