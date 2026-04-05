import { FolderEditorViewer } from '@/components/folder-editor-viewer'
import { ArtifactOutputViewer } from '@/components/opsx/artifact-output-viewer'
import { ChangeCommandBar } from '@/components/opsx/change-command-bar'
import { Tabs, type Tab } from '@/components/tabs'
import { buildOpsxComposeHref, type OpsxComposeActionId } from '@/lib/opsx-compose'
import { useOpsxStatusSubscription } from '@/lib/use-opsx'
import { VTLink, vtNavController } from '@/lib/view-transitions/navigation'
import {
  getSharedElementBinding,
  readSharedElementHandoffState,
} from '@/lib/view-transitions/shared-elements'
import { useRoutedCarouselTabs } from '@/lib/view-transitions/tabs'
import { useLocation, useParams } from '@tanstack/react-router'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  FolderTree,
  GitBranch,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'

function StatusBadge({ status }: { status: 'done' | 'ready' | 'blocked' }) {
  if (status === 'done') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  if (status === 'ready') return <Circle className="h-3.5 w-3.5 text-sky-500" />
  return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
}

export function ChangeView() {
  const { changeId } = useParams({ from: '/changes/$changeId' })
  const location = useLocation()
  const [refreshKey, setRefreshKey] = useState(0)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const sharedDescriptor = useMemo(
    () => ({ family: 'changes', entityId: changeId }) as const,
    [changeId]
  )
  const handoff = readSharedElementHandoffState(location.state)

  const {
    data: status,
    isLoading,
    error,
  } = useOpsxStatusSubscription({ change: changeId, refreshKey })

  const handleComposeAction = useCallback(
    (actionId: OpsxComposeActionId, artifactId?: string) => {
      const href = buildOpsxComposeHref({
        action: actionId,
        changeId,
        artifactId,
      })
      vtNavController.activatePop(href)
    },
    [changeId]
  )

  const handleVerify = useCallback(() => {
    vtNavController.activatePop(`/opsx-verify?change=${encodeURIComponent(changeId)}`)
  }, [changeId])

  const handleRefresh = useCallback(() => {
    setRefreshKey((key) => key + 1)
  }, [])

  const tabs: Tab[] = useMemo(() => {
    if (!status) return []
    return [
      ...status.artifacts.map((artifact) => ({
        id: artifact.id,
        label: artifact.id,
        icon: <StatusBadge status={artifact.status} />,
        content: <ArtifactOutputViewer changeId={changeId} artifact={artifact} />,
      })),
      {
        id: 'folder',
        label: 'Folder',
        icon: <FolderTree className="h-4 w-4" />,
        content: <FolderEditorViewer changeId={changeId} />,
      },
    ]
  }, [status, changeId])

  const selectedArtifactId = useMemo(() => {
    if (!status) return undefined
    return status.artifacts.find((a) => a.status === 'ready')?.id ?? status.artifacts[0]?.id
  }, [status])

  const { tabsRef, selectedTab, onTabChange } = useRoutedCarouselTabs({
    queryKey: 'artifact',
    tabs,
    initialTab: selectedArtifactId ?? tabs[0]?.id,
  })

  const doneCount = status?.artifacts.filter((a) => a.status === 'done').length ?? 0
  const totalCount = status?.artifacts.length ?? 0
  const isMissingChangeError =
    error?.message.includes(`Change '${changeId}' not found`) ||
    error?.message.includes(`Change "${changeId}" not found`)

  if (isLoading && !status) {
    if (handoff) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <div className="flex items-center gap-4">
            <VTLink
              to="/changes"
              vt={{ source: headerRef, sharedElements: sharedDescriptor }}
              className="hover:bg-muted rounded-md p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </VTLink>
            <div
              ref={headerRef}
              {...getSharedElementBinding(sharedDescriptor, 'container')}
              className="flex min-w-0 flex-col gap-1"
            >
              <h1 className="font-nav flex min-w-0 items-center gap-2 text-2xl font-bold">
                <GitBranch
                  {...getSharedElementBinding(sharedDescriptor, 'icon')}
                  className="h-6 w-6 shrink-0"
                />
                <span {...getSharedElementBinding(sharedDescriptor, 'title')} className="truncate">
                  {handoff.title ?? changeId}
                </span>
              </h1>
              <p className="text-muted-foreground text-sm">
                {handoff.subtitle ?? changeId} · Loading change status…
              </p>
            </div>
          </div>
          <div className="vt-detail-content route-loading animate-pulse rounded-lg border p-4">
            Loading change status...
          </div>
        </div>
      )
    }

    return <div className="route-loading animate-pulse">Loading change status...</div>
  }

  if (isMissingChangeError && !status) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4" />
          Change not found in the current project.
        </div>
        <div>
          <VTLink to="/changes" className="text-primary hover:underline">
            Back to Changes
          </VTLink>
        </div>
      </div>
    )
  }

  if (error && !status) {
    return (
      <div className="text-destructive flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        Error loading change: {error.message}
      </div>
    )
  }

  if (!status) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <AlertCircle className="h-4 w-4" />
        Change not found.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <VTLink
            to="/changes"
            vt={{ source: headerRef, sharedElements: sharedDescriptor }}
            className="hover:bg-muted rounded-md p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </VTLink>
          <div
            ref={headerRef}
            {...getSharedElementBinding(sharedDescriptor, 'container')}
            className="flex min-w-0 flex-col gap-1"
          >
            <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
              <GitBranch
                {...getSharedElementBinding(sharedDescriptor, 'icon')}
                className="h-6 w-6 shrink-0"
              />
              <span {...getSharedElementBinding(sharedDescriptor, 'title')}>
                {status.changeName}
              </span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Schema: {status.schemaName} · {doneCount}/{totalCount} artifacts
            </p>
          </div>
        </div>
        <ChangeCommandBar
          status={status}
          selectedArtifactId={selectedArtifactId}
          onComposeAction={handleComposeAction}
          onVerify={handleVerify}
          onRefresh={handleRefresh}
        />
      </div>

      <div className="vt-detail-content flex min-h-0 flex-1 flex-col">
        <Tabs
          ref={tabsRef}
          tabs={tabs}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          className="min-h-0 flex-1"
        />
      </div>
    </div>
  )
}
