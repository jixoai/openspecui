/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Mirror the real row/card/panel/form geometry of each route so the loading skeleton matches settled content.
 * 2. Keep each skeleton composable and layout-agnostic (no Card/border/page-wrapper beyond the mirrored row).
 *
 * Owner direction (2026-07-24): skeleton 结构需符合客观布局情况。每个组件复刻对应路由真实渲染结构，
 * 用 RealtimeSkeleton 块填充，shimmer 光影语言一致。
 */
import { cn } from '@/lib/utils'

import { RealtimeSkeleton, RealtimeSkeletonInventory } from './realtime-skeleton'

// ---- Shared list-row skeleton (icon + title + subtitle + trailing badge/count) ----
// Mirrors change-list / archive-list / spec-list rows: px-4 py-3, flex justify-between.

interface ListRowSkeletonProps {
  /** Width fraction for the title line, e.g. 'w-1/3'. */
  titleWidth?: string
  /** Width fraction for the subtitle line, e.g. 'w-1/4'. */
  subtitleWidth?: string
  className?: string
}

function IconTitleSubtitleRow({
  titleWidth = 'w-1/3',
  subtitleWidth = 'w-1/4',
  className,
}: ListRowSkeletonProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 py-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {/* icon position: mirrors GitBranch/Archive/FileText h-5 w-5 */}
        <RealtimeSkeleton className="mt-0.5 size-5 shrink-0" />
        <div className="flex-1 space-y-2">
          <RealtimeSkeleton className={cn('h-4', titleWidth)} />
          <RealtimeSkeleton className={cn('h-3', subtitleWidth)} />
        </div>
      </div>
      {/* trailing badge + count position */}
      <div className="flex flex-col items-end gap-1.5">
        <RealtimeSkeleton className="h-5 w-16" />
        <RealtimeSkeleton className="h-3 w-10" />
      </div>
    </div>
  )
}

/** change-list skeleton: list-divide container + N mirrored change rows. */
export function ChangeListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <RealtimeSkeletonInventory
      mode="list-divide"
      count={count}
      renderRow={() => <IconTitleSubtitleRow titleWidth="w-1/3" subtitleWidth="w-1/4" />}
    />
  )
}

/** archive-list skeleton: same list-row geometry as change-list. */
export function ArchiveListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <RealtimeSkeletonInventory
      mode="list-divide"
      count={count}
      renderRow={() => <IconTitleSubtitleRow titleWidth="w-2/5" subtitleWidth="w-1/5" />}
    />
  )
}

/** spec-list skeleton: list rows with a narrower title (specId) + lock indicator hint. */
export function SpecListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <RealtimeSkeletonInventory
      mode="list-divide"
      count={count}
      renderRow={() => <IconTitleSubtitleRow titleWidth="w-1/4" subtitleWidth="w-1/6" />}
    />
  )
}

// ---- Git skeleton: mirrors WorktreeRow (border px-2.5 py-2, flex justify-between) ----

export function GitWorktreeSkeleton({ count = 4 }: { count?: number }) {
  return (
    <RealtimeSkeletonInventory
      mode="plain"
      count={count}
      renderRow={() => (
        <div className="flex items-start justify-between gap-2 rounded-md border px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <RealtimeSkeleton className="size-4" />
            <RealtimeSkeleton className="h-4 w-28" />
          </div>
          <RealtimeSkeleton className="h-4 w-12" />
        </div>
      )}
    />
  )
}

// ---- Dashboard skeletons: mirror metric grid + trends grid ----

/** Dashboard summary: 6 metric cards in a responsive grid (mirrors grid-cols-2..6 gap-3). */
export function DashboardSummarySkeleton({ count = 6 }: { count?: number }) {
  return (
    <RealtimeSkeletonInventory
      mode="grid-cards"
      containerClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
      count={count}
      renderRow={() => <RealtimeSkeleton className="h-20" />}
    />
  )
}

/** Dashboard trends: 2 wider cards (mirrors grid xl:grid-cols-2 gap-3). */
export function DashboardTrendsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <RealtimeSkeletonInventory
      mode="grid-cards"
      containerClassName="sm:grid-cols-2"
      count={count}
      renderRow={() => <RealtimeSkeleton className="h-32" />}
    />
  )
}

// ---- Detail panel skeleton: header preserved by parent; body is stacked content lines ----

export function DetailPanelSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <RealtimeSkeleton key={index} className={index % 3 === 2 ? 'h-24' : 'h-4'} />
      ))}
    </div>
  )
}

// ---- Config form skeleton: section card + header + labeled field rows ----

export function ConfigFormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <section
      className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4"
      aria-hidden="true"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="space-y-2">
          <RealtimeSkeleton className="h-4 w-40" />
          <RealtimeSkeleton className="h-3 w-56" />
        </div>
        <RealtimeSkeleton className="h-8 w-20" />
      </header>
      <div className="flex flex-col gap-3">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <RealtimeSkeleton className="h-3 w-24" />
            <RealtimeSkeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </section>
  )
}
