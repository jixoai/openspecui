/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Render the Dashboard Code Git refresh preset and action controls.
 * 2. Preserve the parent's rendered binding-token action boundary.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement: Checkpoint 6.11 needs a component boundary that can retain a rendered
 * Dashboard refresh intent while the backend Code binding is replaced.
 */
import { GitAutoRefreshPresetIcon } from '@/components/git/git-shared'
import { Select, type SelectOption } from '@/components/select'
import type { DashboardGitAutoRefreshPreset } from '@/lib/dashboard-git'
import { RefreshCw } from 'lucide-react'

/** Inputs for the Dashboard-owned Code Git refresh control. */
export interface DashboardGitRefreshControlProps {
  options: readonly SelectOption<DashboardGitAutoRefreshPreset>[]
  value: DashboardGitAutoRefreshPreset
  onValueChange: (value: DashboardGitAutoRefreshPreset) => void
  progress: number
  showProgress: boolean
  disabled: boolean
  animated: boolean
  onRefresh: () => void
}

/** Render the Dashboard refresh controls without owning Git binding provenance. */
export function DashboardGitRefreshControl({
  options,
  value,
  onValueChange,
  progress,
  showProgress,
  disabled,
  animated,
  onRefresh,
}: DashboardGitRefreshControlProps) {
  return (
    <div className="border-border bg-card inline-flex overflow-hidden rounded-md border">
      <Select
        value={value}
        options={options}
        onValueChange={onValueChange}
        ariaLabel="Git auto refresh"
        className="text-foreground/75 hover:text-foreground border-r-current/10 bg-muted/20 relative isolate h-7 w-9 shrink-0 justify-center rounded-none border-0 border-r px-0"
        positionerClassName="z-50"
        popupClassName="min-w-[7rem]"
        renderTrigger={({ selectedOption }) => (
          <span className="relative inline-flex h-full w-full items-center justify-center overflow-hidden">
            <span className="bg-muted/20 pointer-events-none absolute inset-0" />
            {showProgress ? (
              <span
                className="bg-primary/30 dark:bg-primary/35 pointer-events-none absolute inset-y-0 left-0 transition-[width]"
                style={{ width: `${progress * 100}%` }}
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center justify-center">
              <GitAutoRefreshPresetIcon preset={selectedOption?.value ?? value} />
            </span>
          </span>
        )}
      />
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled}
        className={`inline-flex h-7 items-center gap-1 px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
          animated ? 'text-primary bg-primary/10' : 'text-foreground/75 hover:text-foreground'
        }`}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${animated ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  )
}
