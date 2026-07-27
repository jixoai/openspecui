/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Group formal tracked tasks into readable sections and progress summaries.
 * 2. Preserve exact physical task identity through rendering and mutation callbacks.
 * 3. Lock task controls while their network mutation is running.
 *
 * Original request (2026-07-15): "trackedTaskProgress alone drives workflow state."
 */
import { TocSection, type TocItem } from '@/components/toc'
import type { TrackedTask, TrackedTaskLocation, TrackedTaskProgress } from '@openspecui/core'
import { CheckCircle, Circle, Loader2 } from 'lucide-react'
import { memo, useMemo } from 'react'

/** Group tasks by their section */
interface TaskGroup {
  section: string
  tasks: TrackedTask[]
  completed: number
  total: number
}

/** Group tasks by section and calculate progress per group */
function groupTasksBySection(tasks: TrackedTask[]): TaskGroup[] {
  const groups = new Map<string, TrackedTask[]>()

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
  task: TrackedTask
  isToggling: boolean
  onToggle?: (location: TrackedTaskLocation, completed: boolean) => void
  readonly?: boolean
}

const TaskItem = memo(
  function TaskItem({ task, isToggling, onToggle, readonly }: TaskItemProps) {
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
        onClick={() => onToggle(task.location, !task.completed)}
        className="hover:bg-muted/50 group flex w-full items-center gap-3 p-3 text-left transition-colors disabled:cursor-wait disabled:opacity-70"
        disabled={isToggling}
      >
        {content}
      </button>
    )
  },
  (prev, next) =>
    prev.task.id === next.task.id &&
    prev.task.text === next.task.text &&
    prev.task.completed === next.task.completed &&
    prev.task.location.filePath === next.task.location.filePath &&
    prev.task.location.taskIndex === next.task.location.taskIndex &&
    prev.isToggling === next.isToggling &&
    prev.onToggle === next.onToggle &&
    prev.readonly === next.readonly
)

export interface TasksViewProps {
  trackedTaskProgress: TrackedTaskProgress
  /** Callback when a task is toggled. If not provided, tasks are readonly. */
  onToggleTask?: (location: TrackedTaskLocation, completed: boolean) => void
  /** Location of the task currently being toggled (for loading state) */
  togglingLocation?: TrackedTaskLocation | null
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
  trackedTaskProgress,
  onToggleTask,
  togglingLocation = null,
  tocBaseIndex = 0,
  readonly = false,
}: TasksViewProps) {
  const { tasks } = trackedTaskProgress
  const taskGroups = useMemo(() => groupTasksBySection(tasks), [tasks])

  const progressPercent =
    trackedTaskProgress.total > 0
      ? Math.round((trackedTaskProgress.completed / trackedTaskProgress.total) * 100)
      : 0

  return (
    <TocSection id="tasks" index={tocBaseIndex}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Tasks ({trackedTaskProgress.completed}/{trackedTaskProgress.total})
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
                {group.tasks.map((task) => {
                  return (
                    <TaskItem
                      key={task.id}
                      task={task}
                      isToggling={
                        togglingLocation?.filePath === task.location.filePath &&
                        togglingLocation.taskIndex === task.location.taskIndex
                      }
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
export function useTaskGroups(tasks: TrackedTask[]) {
  return useMemo(() => groupTasksBySection(tasks), [tasks])
}
