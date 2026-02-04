import { ChangeOverview } from '@/components/change-overview'
import { FolderEditorViewer } from '@/components/folder-editor-viewer'
import { Tabs, type Tab } from '@/components/tabs'
import { TasksView } from '@/components/tasks-view'
import { useArchiveModal } from '@/lib/archive-modal-context'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useChangeSubscription } from '@/lib/use-subscription'
import { useTabsStatusByQuery } from '@/lib/use-tabs-status-by-query'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  FileText,
  FolderTree,
  GitBranch,
  ListChecks,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export function ChangeView() {
  const { changeId } = useParams({ from: '/changes/$changeId' })
  const navigate = useNavigate()
  const { openArchiveModal, state: archiveModalState } = useArchiveModal()
  const { data: change, isLoading } = useChangeSubscription(changeId)
  const [firstFrameLoading, setFirstFrameLoading] = useState(true)
  useEffect(() => {
    const id = requestAnimationFrame(() => setFirstFrameLoading(false))
    return () => cancelAnimationFrame(id)
  }, [])

  // 保存最后一次有效的 changeName，用于在 change 被删除后打开 Modal
  const lastChangeNameRef = useRef(change?.name ?? changeId)
  if (change?.name) {
    lastChangeNameRef.current = change.name
  }

  // 当 change 不存在且不在加载中且 Archive Modal 打开时，自动返回到 /changes
  useEffect(() => {
    if (!isLoading && !change && archiveModalState.open) {
      navigate({ to: '/changes' })
    }
  }, [isLoading, change, archiveModalState.open, navigate])
  // TODO: validation 暂时不支持订阅，后续可以添加
  const validation = null as {
    valid: boolean
    issues: Array<{ severity: string; message: string; path?: string }>
  } | null

  const toggleTaskMutation = useMutation({
    mutationFn: (params: { taskIndex: number; completed: boolean }) =>
      trpcClient.change.toggleTask.mutate({
        changeId,
        taskIndex: params.taskIndex,
        completed: params.completed,
      }),
    // 订阅模式下无需手动 invalidate，文件变更会自动触发更新
  })

  const handleToggleTask = useCallback(
    (taskIndex: number, completed: boolean) => {
      toggleTaskMutation.mutate({ taskIndex, completed })
    },
    [toggleTaskMutation]
  )

  const togglingIndex = toggleTaskMutation.isPending
    ? (toggleTaskMutation.variables?.taskIndex ?? null)
    : null

  // 点击 Archive 按钮：打开全局 Modal
  const handleArchiveClick = useCallback(() => {
    openArchiveModal(changeId, lastChangeNameRef.current)
  }, [changeId, openArchiveModal])

  const tabs: Tab[] = useMemo(() => {
    if (!change) return []

    return [
      {
        id: 'overview',
        label: 'Overview',
        icon: <FileText className="h-4 w-4" />,
        content: <ChangeOverview change={change} />,
      },
      {
        id: 'tasks',
        label: `Tasks (${change.progress.completed}/${change.progress.total})`,
        icon: <ListChecks className="h-4 w-4" />,
        content: (
          <TasksView
            tasks={change.tasks}
            progress={change.progress}
            onToggleTask={isStaticMode() ? undefined : handleToggleTask}
            togglingIndex={togglingIndex}
          />
        ),
      },
      {
        id: 'folder',
        label: 'Folder',
        icon: <FolderTree className="h-4 w-4" />,
        content: <FolderEditorViewer changeId={changeId} />,
      },
    ]
  }, [change, changeId, handleToggleTask, togglingIndex])

  const { selectedTab, setSelectedTab } = useTabsStatusByQuery({
    tabsId: 'changeTab',
    tabs,
    initialTab: tabs[0]?.id,
  })

  if (firstFrameLoading || (isLoading && !change)) {
    return <div className="route-loading animate-pulse">Loading change...</div>
  }

  // 当 change 不存在时，显示空白（useEffect 会自动导航到 /changes）
  // 如果 Archive Modal 打开着，用户看到的是 Modal 覆盖的 /changes 页面
  if (!change) {
    return null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="change-header @container flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link to="/changes" className="hover:bg-muted rounded-md p-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-col gap-1">
            <h1
              className="font-nav flex items-center gap-2 font-bold"
              style={{ fontSize: 'clamp(1rem, 3cqi, 1.75rem)' }}
            >
              <GitBranch className="h-6 w-6 shrink-0" />
              {change.name}
            </h1>
            <p className="text-muted-foreground" style={{ fontSize: 'clamp(0.7rem, 2cqi, 1rem)' }}>
              ID: {change.id}
            </p>
          </div>
        </div>

        {/* Hide archive button in static mode */}
        {!isStaticMode() && (
          <button
            onClick={handleArchiveClick}
            className="change-archive-button @sm:gap-2 @sm:px-4 flex h-10 items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-white hover:bg-red-700"
          >
            <Archive className="h-4 w-4" />
            <span
              className="change-archive-text @sm:inline hidden"
              style={{ fontSize: 'clamp(0.85rem, 2cqi, 1rem)' }}
            >
              Archive
            </span>
          </button>
        )}
      </div>

      {validation && !validation.valid && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4">
          <div className="mb-2 flex items-center gap-2 font-medium text-red-600">
            <AlertCircle className="h-5 w-5" />
            Validation Issues
          </div>
          <ul className="space-y-1 text-sm">
            {validation.issues.map((issue, i) => (
              <li key={i} className="text-red-600">
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Tabs
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
        className="min-h-0 flex-1 gap-6"
      />
    </div>
  )
}
