import { ChangeOverview } from '@/components/change-overview'
import { FolderEditorViewer } from '@/components/folder-editor-viewer'
import { Tabs, type Tab } from '@/components/tabs'
import { TasksView } from '@/components/tasks-view'
import { useArchiveSubscription } from '@/lib/use-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import {
  getSharedElementBinding,
  readSharedElementHandoffState,
} from '@/lib/view-transitions/shared-elements'
import { useRoutedCarouselTabs } from '@/lib/view-transitions/tabs'
import { getRouteApi, useLocation } from '@tanstack/react-router'
import { Archive, ArrowLeft, CheckCircle, FileText, FolderTree, ListChecks } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

const route = getRouteApi('/archive/$changeId')

export function ArchiveView() {
  const { changeId } = route.useParams()
  const location = useLocation()

  const { data: change } = useArchiveSubscription(changeId)
  const [loading, setLoading] = useState(true)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const sharedDescriptor = useMemo(
    () => ({ family: 'archive', entityId: changeId }) as const,
    [changeId]
  )
  const handoff = readSharedElementHandoffState(location.state)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLoading(false))
    return () => cancelAnimationFrame(id)
  }, [])

  const tabs = useMemo<Tab[]>(() => {
    if (!change) return []

    const result: Tab[] = [
      {
        id: 'overview',
        label: 'Overview',
        icon: <FileText className="h-4 w-4" />,
        content: <ChangeOverview change={change} />,
      },
    ]

    if (change.tasks.length > 0) {
      result.push({
        id: 'tasks',
        label: `Tasks (${change.progress.completed}/${change.progress.total})`,
        icon: <ListChecks className="h-4 w-4" />,
        content: (
          <div className="border-border scrollbar-thin scrollbar-track-transparent h-full overflow-auto rounded-lg border p-4">
            <TasksView tasks={change.tasks} progress={change.progress} readonly />
          </div>
        ),
      })
    }

    result.push({
      id: 'folder',
      label: 'Folder',
      icon: <FolderTree className="h-4 w-4" />,
      content: <FolderEditorViewer changeId={changeId} archived />,
    })

    return result
  }, [change, changeId])

  const { tabsRef, selectedTab, onTabChange } = useRoutedCarouselTabs({
    queryKey: 'archiveTab',
    tabs,
    initialTab: tabs[0]?.id,
  })

  if (loading && !change) {
    if (handoff) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
          <div className="flex items-center gap-4">
            <VTLink
              to="/archive"
              vt={{ source: headerRef, sharedElements: sharedDescriptor }}
              className="hover:bg-muted rounded-md p-2 transition-colors"
              title="Back to Archive"
            >
              <ArrowLeft className="h-5 w-5" />
            </VTLink>
            <div ref={headerRef} {...getSharedElementBinding(sharedDescriptor, 'container')}>
              <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
                <Archive
                  {...getSharedElementBinding(sharedDescriptor, 'icon')}
                  className="h-6 w-6 shrink-0"
                />
                <span {...getSharedElementBinding(sharedDescriptor, 'title')}>
                  {handoff.title ?? changeId}
                </span>
              </h1>
              <p className="text-muted-foreground text-sm">{handoff.subtitle ?? changeId}</p>
            </div>
          </div>
          <div className="vt-detail-content route-loading animate-pulse rounded-lg border p-4">
            Loading archived change...
          </div>
        </div>
      )
    }

    return <div className="route-loading animate-pulse">Loading archived change...</div>
  }

  if (!change) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Archived change not found: {changeId}</p>
        <VTLink to="/archive" className="text-primary mt-4 inline-block hover:underline">
          Back to Archive
        </VTLink>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <VTLink
          to="/archive"
          vt={{ source: headerRef, sharedElements: sharedDescriptor }}
          className="hover:bg-muted rounded-md p-2 transition-colors"
          title="Back to Archive"
        >
          <ArrowLeft className="h-5 w-5" />
        </VTLink>
        <div ref={headerRef} {...getSharedElementBinding(sharedDescriptor, 'container')}>
          <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
            <Archive
              {...getSharedElementBinding(sharedDescriptor, 'icon')}
              className="h-6 w-6 shrink-0"
            />
            <span {...getSharedElementBinding(sharedDescriptor, 'title')}>{change.name}</span>
          </h1>
          <p className="text-muted-foreground text-sm">{changeId}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span className="text-green-600">
          Completed: {change.progress.completed}/{change.progress.total} tasks
        </span>
      </div>

      {/* Tabs with Activity for state preservation */}
      <div className="vt-detail-content flex min-h-0 flex-1 flex-col">
        <Tabs
          ref={tabsRef}
          tabs={tabs}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          className="min-h-0 flex-1 gap-6"
        />
      </div>
    </div>
  )
}
