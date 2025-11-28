import { memo, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc, trpcClient } from '@/lib/trpc'
import { useChangeRealtimeUpdates } from '@/lib/use-realtime'
import { useParams, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Archive, CheckCircle, Circle, AlertCircle, Loader2 } from 'lucide-react'
import { MarkdownContent } from '@/components/markdown-content'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Toc, TocSection, type TocItem } from '@/components/toc'

interface Task {
  id: string
  text: string
  completed: boolean
  section?: string
}

/** Group tasks by their section */
interface TaskGroup {
  section: string
  tasks: Task[]
  completed: number
  total: number
}

interface TaskItemProps {
  task: Task
  taskIndex: number
  isToggling: boolean
  onToggle: (taskIndex: number, completed: boolean) => void
}

const TaskItem = memo(
  function TaskItem({ task, taskIndex, isToggling, onToggle }: TaskItemProps) {
    return (
      <button
        onClick={() => onToggle(taskIndex, !task.completed)}
        className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
      >
        {isToggling ? (
          <Loader2 className="w-5 h-5 text-primary shrink-0 animate-spin" />
        ) : task.completed ? (
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground shrink-0 hover:text-primary" />
        )}
        <span className={task.completed ? 'line-through text-muted-foreground' : ''}>
          {task.text}
        </span>
        {task.section && (
          <span className="ml-auto text-xs px-2 py-1 bg-muted rounded">{task.section}</span>
        )}
      </button>
    )
  },
  (prev, next) =>
    prev.task.id === next.task.id &&
    prev.task.completed === next.task.completed &&
    prev.isToggling === next.isToggling
)

/** Group tasks by section and calculate progress per group */
function groupTasksBySection(tasks: Task[]): TaskGroup[] {
  const groups = new Map<string, Task[]>()

  for (const task of tasks) {
    const section = task.section || 'General'
    const existing = groups.get(section) || []
    existing.push(task)
    groups.set(section, existing)
  }

  return Array.from(groups.entries()).map(([section, sectionTasks]) => ({
    section,
    tasks: sectionTasks,
    completed: sectionTasks.filter((t) => t.completed).length,
    total: sectionTasks.length,
  }))
}

/** Generate a stable ID for a section name */
function sectionToId(section: string): string {
  return `section-${section.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export function ChangeView() {
  const { changeId } = useParams({ from: '/changes/$changeId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Subscribe to realtime updates for this specific change
  useChangeRealtimeUpdates(changeId)

  const { data: change, isLoading } = useQuery(trpc.change.get.queryOptions({ id: changeId }))
  const { data: validation } = useQuery(trpc.change.validate.queryOptions({ id: changeId }))

  const archiveMutation = useMutation({
    mutationFn: () => trpcClient.change.archive.mutate({ id: changeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['change', 'listArchived'] })
      navigate({ to: '/changes' })
    },
  })

  const toggleTaskMutation = useMutation({
    mutationFn: (params: { taskIndex: number; completed: boolean }) =>
      trpcClient.change.toggleTask.mutate({
        changeId,
        taskIndex: params.taskIndex,
        completed: params.completed,
      }),
    onSuccess: () => {
      // Refetch to get updated data
      queryClient.invalidateQueries({ queryKey: [['change', 'get']] })
    },
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
  const taskGroups = useMemo(() => {
    if (!change) return []
    return groupTasksBySection(change.tasks)
  }, [change])

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
    for (const group of taskGroups) {
      items.push({
        id: sectionToId(group.section),
        label: `${group.section} (${group.completed}/${group.total})`,
        level: 2,
      })
    }

    return items
  }, [change, taskGroups])

  if (isLoading) {
    return <div className="animate-pulse">Loading change...</div>
  }

  if (!change) {
    return <div className="text-red-600">Change not found</div>
  }

  const progressPercent =
    change.progress.total > 0
      ? Math.round((change.progress.completed / change.progress.total) * 100)
      : 0

  // Calculate task index offset for each group (for toggle mutation)
  const getTaskIndex = (groupIndex: number, taskIndexInGroup: number): number => {
    let offset = 0
    for (let i = 0; i < groupIndex; i++) {
      offset += taskGroups[i].tasks.length
    }
    return offset + taskIndexInGroup + 1
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
          onClick={() => archiveMutation.mutate()}
          disabled={archiveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-md disabled:opacity-50"
        >
          <Archive className="w-4 h-4" />
          {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
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

          <TocSection id="tasks" index={change.deltas.length > 0 ? 3 : 2}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                Tasks ({change.progress.completed}/{change.progress.total})
              </h2>
              <span className="text-sm text-muted-foreground">{progressPercent}%</span>
            </div>

            <div className="w-full bg-muted rounded-full h-2 mb-4">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Grouped tasks by section */}
            <div className="space-y-6">
              {taskGroups.map((group, groupIndex) => {
                const sectionId = sectionToId(group.section)
                const sectionPercent =
                  group.total > 0 ? Math.round((group.completed / group.total) * 100) : 0
                // Base index: why(0) + what-changes(1) + affected-specs?(2) + tasks(3 or 2) + groupIndex
                const baseIndex = change.deltas.length > 0 ? 4 : 3

                return (
                  <TocSection key={group.section} id={sectionId} index={baseIndex + groupIndex} as="div">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-foreground">{group.section}</h3>
                      <span className="text-xs text-muted-foreground">
                        {group.completed}/{group.total} ({sectionPercent}%)
                      </span>
                    </div>
                    <div className="border border-border rounded-lg divide-y divide-border">
                      {group.tasks.map((task, taskIndexInGroup) => {
                        const taskIndex = getTaskIndex(groupIndex, taskIndexInGroup)
                        return (
                          <TaskItem
                            key={task.id}
                            task={task}
                            taskIndex={taskIndex}
                            isToggling={togglingIndex === taskIndex}
                            onToggle={handleToggleTask}
                          />
                        )
                      })}
                    </div>
                  </TocSection>
                )
              })}
              {taskGroups.length === 0 && (
                <div className="p-4 text-muted-foreground text-center border border-border rounded-lg">
                  No tasks defined
                </div>
              )}
            </div>
          </TocSection>
        </div>
      </MarkdownViewer>
    </div>
  )
}
