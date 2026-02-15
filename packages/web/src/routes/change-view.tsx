import { ArtifactOutputViewer } from '@/components/opsx/artifact-output-viewer'
import { ChangeCommandBar } from '@/components/opsx/change-command-bar'
import { FolderEditorViewer } from '@/components/folder-editor-viewer'
import { Tabs, type Tab } from '@/components/tabs'
import { useOpsxStatusSubscription } from '@/lib/use-opsx'
import { useTerminalContext } from '@/lib/terminal-context'
import { useTabsStatusByQuery } from '@/lib/use-tabs-status-by-query'
import { Link, useParams } from '@tanstack/react-router'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  FolderTree,
  GitBranch,
} from 'lucide-react'
import { useCallback, useMemo } from 'react'

function StatusBadge({ status }: { status: 'done' | 'ready' | 'blocked' }) {
  if (status === 'done') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  if (status === 'ready') return <Circle className="h-3.5 w-3.5 text-sky-500" />
  return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
}

export function ChangeView() {
  const { changeId } = useParams({ from: '/changes/$changeId' })

  const {
    data: status,
    isLoading,
    error,
  } = useOpsxStatusSubscription({ change: changeId })

  const { createDedicatedSession } = useTerminalContext()

  const handleRunCommand = useCallback(
    (command: string, args: string[]) => {
      createDedicatedSession(command, args)
    },
    [createDedicatedSession]
  )

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

  const { selectedTab, setSelectedTab } = useTabsStatusByQuery({
    tabsId: 'artifact',
    tabs,
    initialTab: tabs[0]?.id,
  })

  const doneCount = status?.artifacts.filter((a) => a.status === 'done').length ?? 0
  const totalCount = status?.artifacts.length ?? 0

  if (isLoading && !status) {
    return <div className="route-loading animate-pulse">Loading change status...</div>
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
          <Link to="/changes" className="hover:bg-muted rounded-md p-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
              <GitBranch className="h-6 w-6 shrink-0" />
              {status.changeName}
            </h1>
            <p className="text-muted-foreground text-sm">
              Schema: {status.schemaName} · {doneCount}/{totalCount} artifacts
            </p>
          </div>
        </div>
        <ChangeCommandBar
          changeId={changeId}
          status={status}
          selectedArtifactId={selectedArtifactId}
          onRunCommand={handleRunCommand}
        />
      </div>

      {/* Tabs: artifacts + folder */}
      <Tabs
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
        className="min-h-0 flex-1"
      />
    </div>
  )
}
