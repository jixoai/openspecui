/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Keep active Planning identity direct while preserving Launch identity in accessible detail.
 * 2. Preserve loading, refreshing, stale, and error status without unlocking root actions.
 * 3. Compress Root source and Store provenance without introducing a root switcher.
 *
 * Original request (2026-07-15): "One project backend has one launch project and one CLI-selected writable planning root."
 * Original request (2026-07-28): restore 5.x-like clarity while keeping 6.x context facts retrievable.
 */
import { Badge } from '@/components/badge'
import { isStaticMode } from '@/lib/static-mode'
import { selectRootContextSnapshot, useContextSubscription } from '@/lib/use-context-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import { AlertCircle, GitBranch, RefreshCw } from 'lucide-react'
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
  const tooltip = (
    <div className="space-y-1">
      <div>Planning: {context?.planningRoot?.path ?? planningLabel}</div>
      <div>Launch: {context?.launchProject.path ?? launchLabel}</div>
      <div>
        Source: {context?.planningRoot?.source ?? 'unresolved'}
        {context?.storeId ? ` · Store ${context.storeId}` : ''}
      </div>
    </div>
  )

  if (variant === 'mobile') {
    return (
      <Tooltip content={tooltip}>
        <VTLink
          to="/context"
          onClick={onNavigate}
          aria-label={accessibleLabel}
          className="hover:bg-muted flex min-w-0 max-w-[min(52vw,18rem)] items-center gap-2 rounded-md px-1.5 py-1"
        >
          <RootStateIcon refreshing={refreshing || (isLoading && !context)} failed={failed} />
          <span className="leading-3.5 min-w-0 text-[10px]">
            <span className="text-muted-foreground block">Planning</span>
            <span className="block truncate font-medium" title={context?.planningRoot?.path}>
              {planningLabel}
            </span>
          </span>
        </VTLink>
      </Tooltip>
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
    <Tooltip content={tooltip} sideOffset={12}>
      <VTLink
        to="/context"
        onClick={onNavigate}
        aria-label={accessibleLabel}
        className="border-border hover:bg-muted/70 mb-4 flex min-w-0 items-center gap-2 border-y py-2"
      >
        <RootStateIcon refreshing={refreshing || (isLoading && !context)} failed={failed} />
        <span className="min-w-0 flex-1 text-xs">
          <span className="text-muted-foreground block text-[10px]">Planning</span>
          <span className="block truncate font-medium" title={context?.planningRoot?.path}>
            {planningLabel}
          </span>
        </span>
        {context?.planningRoot ? (
          <Badge tone="muted" size="xs" shape="box" className="max-w-20 truncate">
            {context.planningRoot.source}
            {context.storeId ? ` · ${context.storeId}` : ''}
          </Badge>
        ) : null}
      </VTLink>
    </Tooltip>
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
