/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. List only archives projected from the current writable Planning root.
 * 2. Preserve Archive detail navigation and physical row continuity across reactive list changes.
 * 3. Render resolved Archive data and empty/loading states without an artificial first-frame gate.
 * 4. Surface transport errors while retaining stale rows without false empty claims.
 * 5. Project real dependency-driven recomputation beside retained Archive data.
 *
 * Original request (2026-07-15): "One project backend has one launch project and one CLI-selected writable planning root."
 * Owner report (2026-07-22): "整个过程中，几乎都在 Loading。"
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 */
import { ArchiveListSkeleton, RealtimeRevalidateCue } from '@/components/realtime'
import { formatRelativeTime } from '@/lib/format-time'
import { useArchivesSubscription } from '@/lib/use-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import { getSharedElementBinding } from '@/lib/view-transitions/shared-elements'
import { useArchiveListContinuity } from '@/routes/archive-list-continuity'
import { AlertCircle, Archive, ChevronRight } from 'lucide-react'
import { useRef } from 'react'

export function ArchiveList() {
  const { data: archived, isLoading, isUpdating, error } = useArchivesSubscription()
  const listRef = useRef<HTMLDivElement>(null)
  const displayedArchives = useArchiveListContinuity(archived, listRef)

  if (isLoading && !archived && !error) {
    // Preserve page chrome and render a stable skeleton body rather than a full-tree barrier.
    return (
      <div className="space-y-6 p-4">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <Archive className="h-6 w-6 shrink-0" />
          Archive
        </h1>
        <ArchiveListSkeleton count={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <Archive className="h-6 w-6 shrink-0" />
        Archive
      </h1>

      <p className="text-muted-foreground">
        Completed changes archived in the current writable Planning root.
      </p>

      {error ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Archive subscription failed.</p>
            <p className="break-words">{error.message}</p>
          </div>
        </div>
      ) : null}

      {archived && (!error || archived.length > 0) ? (
        <RealtimeRevalidateCue active={isUpdating}>
          <div
            ref={listRef}
            data-archive-list-continuity
            className="border-border divide-border divide-y rounded-lg border"
          >
            {displayedArchives?.map((change) => {
              const sharedDescriptor = { family: 'archive', entityId: change.id } as const

              return (
                <VTLink
                  key={change.id}
                  to="/archive/$changeId"
                  params={{ changeId: change.id }}
                  state={(prev) => ({
                    ...prev,
                    __vtHandoff: {
                      family: 'archive',
                      entityId: change.id,
                      title: change.name,
                      subtitle: change.id,
                    },
                  })}
                  vt={{ sharedElements: sharedDescriptor }}
                  {...getSharedElementBinding(sharedDescriptor, 'container')}
                  className="hover:bg-muted/50 flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <Archive
                      {...getSharedElementBinding(sharedDescriptor, 'icon')}
                      className="text-muted-foreground h-5 w-5"
                    />
                    <div>
                      <div
                        {...getSharedElementBinding(sharedDescriptor, 'title')}
                        className="font-medium"
                      >
                        {change.name}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {change.id}
                        {change.updatedAt > 0 && <> · {formatRelativeTime(change.updatedAt)}</>}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground h-4 w-4" />
                </VTLink>
              )
            })}
            {displayedArchives?.length === 0 && !isUpdating && (
              <div className="text-muted-foreground p-8 text-center">
                <Archive className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>No archived changes yet.</p>
                <p className="mt-2 text-sm">
                  Changes in this Planning root are archived using{' '}
                  <code className="bg-muted rounded px-1">openspec archive</code>
                </p>
              </div>
            )}
          </div>
        </RealtimeRevalidateCue>
      ) : null}
    </div>
  )
}
