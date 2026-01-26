import { TocSection, type TocItem } from '@/components/toc'
import { CheckCircle, Circle, Loader2 } from 'lucide-react'
import { memo, useMemo } from 'react'

/** Task item structure from @openspecui/core */
export interface Task {
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
export function sectionToId(section: string): string {
  return `section-${section
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
}

/** Build ToC items for task sections */
export function buildTaskTocItems(taskGroups: TaskGroup[]): TocItem[] {
  return taskGroups.map((group) => ({
    id: sectionToId(group.section),
    label: `${group.section} (${group.completed}/${group.total})`,
    level: 2,
  }))
}

interface TaskItemProps {
  task: Task
  taskIndex: number
  isToggling: boolean
  onToggle?: (taskIndex: number, completed: boolean) => void
  readonly?: boolean
}

const TaskItem = memo(
  function TaskItem({ task, taskIndex, isToggling, onToggle, readonly }: TaskItemProps) {
    const content = (
      <>
        {isToggling ? (
          <Loader2 className="text-primary h-5 w-5 shrink-0 animate-spin" />
        ) : task.completed ? (
          <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
        ) : (
          <Circle className="text-muted-foreground group-hover:text-primary h-5 w-5 shrink-0" />
        )}
        <span className={`text-sm ${task.completed ? 'text-muted-foreground line-through' : ''}`}>
          {task.text}
        </span>
      </>
    )

    if (readonly || !onToggle) {
      return <div className="flex w-full items-center gap-3 p-3 text-left">{content}</div>
    }

    return (
      <button
        onClick={() => onToggle(taskIndex, !task.completed)}
        className="hover:bg-muted/50 group flex w-full items-center gap-3 p-3 text-left transition-colors"
      >
        {content}
      </button>
    )
  },
  (prev, next) =>
    prev.task.id === next.task.id &&
    prev.task.text === next.task.text &&
    prev.task.completed === next.task.completed &&
    prev.isToggling === next.isToggling &&
    prev.readonly === next.readonly
)

export interface TasksViewProps {
  tasks: Task[]
  progress: { total: number; completed: number }
  /** Callback when a task is toggled. If not provided, tasks are readonly. */
  onToggleTask?: (taskIndex: number, completed: boolean) => void
  /** Index of the task currently being toggled (for loading state) */
  togglingIndex?: number | null
  /** Base index for TocSection (for proper ToC navigation) */
  tocBaseIndex?: number
  /** Whether to show as readonly (no interaction) */
  readonly?: boolean
}

/**
 * Unified Tasks view component.
 * Used in both change-view (interactive) and archive-view (readonly).
 */
export function TasksView({
  tasks,
  progress,
  onToggleTask,
  togglingIndex = null,
  tocBaseIndex = 0,
  readonly = false,
}: TasksViewProps) {
  const taskGroups = useMemo(() => groupTasksBySection(tasks), [tasks])

  const progressPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  // Calculate task index offset for each group (for toggle mutation)
  const getTaskIndex = (groupIndex: number, taskIndexInGroup: number): number => {
    let offset = 0
    for (let i = 0; i < groupIndex; i++) {
      offset += taskGroups[i].tasks.length
    }
    return offset + taskIndexInGroup + 1
  }

  return (
    <TocSection id="tasks" index={tocBaseIndex}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Tasks ({progress.completed}/{progress.total})
        </h2>
        <span className="text-muted-foreground text-sm">{progressPercent}%</span>
      </div>

      <div className="bg-muted mb-4 h-2 w-full rounded-full">
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

          return (
            <TocSection
              key={group.section}
              id={sectionId}
              index={tocBaseIndex + 1 + groupIndex}
              as="div"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-foreground font-medium">{group.section}</h3>
                <span className="text-muted-foreground text-xs">
                  {group.completed}/{group.total} ({sectionPercent}%)
                </span>
              </div>
              <div className="border-border divide-border divide-y rounded-lg border">
                {group.tasks.map((task, taskIndexInGroup) => {
                  const taskIndex = getTaskIndex(groupIndex, taskIndexInGroup)
                  return (
                    <TaskItem
                      key={task.id}
                      task={task}
                      taskIndex={taskIndex}
                      isToggling={togglingIndex === taskIndex}
                      onToggle={onToggleTask}
                      readonly={readonly}
                    />
                  )
                })}
              </div>
            </TocSection>
          )
        })}
        {taskGroups.length === 0 && (
          <div className="text-muted-foreground border-border rounded-lg border p-4 text-center">
            No tasks defined
          </div>
        )}
      </div>
    </TocSection>
  )
}

/** Hook to get task groups for ToC building */
export function useTaskGroups(tasks: Task[]) {
  return useMemo(() => groupTasksBySection(tasks), [tasks])
}
