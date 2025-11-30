import { useCallback, useMemo, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { trpcClient } from '@/lib/trpc'
import { useChangeSubscription } from '@/lib/use-subscription'
import { useArchiveModal } from '@/lib/archive-modal-context'
import { useParams, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Archive, AlertCircle } from 'lucide-react'
import { MarkdownContent } from '@/components/markdown-content'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Toc, TocSection, type TocItem } from '@/components/toc'
import { TasksView, useTaskGroups, buildTaskTocItems } from '@/components/tasks-view'

export function ChangeView() {
  const { changeId } = useParams({ from: '/changes/$changeId' })
  const navigate = useNavigate()
  const { openArchiveModal, state: archiveModalState } = useArchiveModal()

  const { data: change, isLoading } = useChangeSubscription(changeId)

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
  const validation = null as { valid: boolean; issues: Array<{ severity: string; message: string; path?: string }> } | null

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
    ? toggleTaskMutation.variables?.taskIndex ?? null
    : null

  // Group tasks by section - must be before any conditional returns
  const taskGroups = useTaskGroups(change?.tasks ?? [])

  // Build ToC items from change sections - must be before any conditional returns
  const tocItems = useMemo<TocItem[]>(() => {
    if (!change) return []

    const items: TocItem[] = [
      { id: 'why', label: 'Why', level: 1 },
      { id: 'what-changes', label: 'What Changes', level: 1 },
    ]

    if (change.deltas.length > 0) {
      items.push({ id: 'affected-specs', label: 'Affected Specs', level: 1 })
    }

    items.push({ id: 'tasks', label: 'Tasks', level: 1 })

    // Add task sections to ToC
    items.push(...buildTaskTocItems(taskGroups))

    return items
  }, [change, taskGroups])

  // 点击 Archive 按钮：打开全局 Modal
  const handleArchiveClick = useCallback(() => {
    // 使用 ref 中保存的 changeName，确保即使 change 被删除也能正常显示
    openArchiveModal(changeId, lastChangeNameRef.current)
  }, [changeId, openArchiveModal])

  // Calculate base index for TasksView ToC sections
  // why(0) + what-changes(1) + affected-specs?(2) + tasks(3 or 2)
  const tasksTocBaseIndex = change ? (change.deltas.length > 0 ? 3 : 2) : 0

  if (isLoading) {
    return <div className="animate-pulse">Loading change...</div>
  }

  // 当 change 不存在时，显示空白（useEffect 会自动导航到 /changes）
  // 如果 Archive Modal 打开着，用户看到的是 Modal 覆盖的 /changes 页面
  if (!change) {
    return null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/changes" className="p-2 hover:bg-muted rounded-md">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{change.name}</h1>
            <p className="text-muted-foreground">ID: {change.id}</p>
          </div>
        </div>

        <button
          onClick={handleArchiveClick}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
        >
          <Archive className="w-4 h-4" />
          Archive
        </button>
      </div>

      {validation && !validation.valid && (
        <div className="border border-red-500 bg-red-500/10 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 font-medium mb-2">
            <AlertCircle className="w-5 h-5" />
            Validation Issues
          </div>
          <ul className="text-sm space-y-1">
            {validation.issues.map((issue, i) => (
              <li key={i} className="text-red-600">
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <MarkdownViewer
        toc={<Toc items={tocItems} className="viewer-toc" />}
        tocItems={tocItems}
        className="min-h-0 flex-1"
      >
        <div className="space-y-6">
          <TocSection id="why" index={0}>
            <h2 className="text-lg font-semibold mb-2">Why</h2>
            <div className="p-4 bg-muted/30 rounded-lg">
              {change.why ? (
                <MarkdownContent>{change.why}</MarkdownContent>
              ) : (
                <span className="text-muted-foreground">No description</span>
              )}
            </div>
          </TocSection>

          <TocSection id="what-changes" index={1}>
            <h2 className="text-lg font-semibold mb-2">What Changes</h2>
            <div className="p-4 bg-muted/30 rounded-lg">
              {change.whatChanges ? (
                <MarkdownContent>{change.whatChanges}</MarkdownContent>
              ) : (
                <span className="text-muted-foreground">No changes listed</span>
              )}
            </div>
          </TocSection>

          {change.deltas.length > 0 && (
            <TocSection id="affected-specs" index={2}>
              <h2 className="text-lg font-semibold mb-3">Affected Specs ({change.deltas.length})</h2>
              <div className="border border-border rounded-lg divide-y divide-border">
                {change.deltas.map((delta, i) => (
                  <div key={i} className="p-3 flex items-center justify-between">
                    <Link
                      to="/specs/$specId"
                      params={{ specId: delta.spec }}
                      className="font-medium hover:underline"
                    >
                      {delta.spec}
                    </Link>
                    <span className="text-sm px-2 py-1 bg-muted rounded">{delta.operation}</span>
                  </div>
                ))}
              </div>
            </TocSection>
          )}

          <TasksView
            tasks={change.tasks}
            progress={change.progress}
            onToggleTask={handleToggleTask}
            togglingIndex={togglingIndex}
            tocBaseIndex={tasksTocBaseIndex}
          />
        </div>
      </MarkdownViewer>
    </div>
  )
}
