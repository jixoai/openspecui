import { useMemo } from 'react'
import { useArchiveSubscription } from '@/lib/use-subscription'
import { getRouteApi } from '@tanstack/react-router'
import { Archive, ArrowLeft, CheckCircle, FileText, ListTodo } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Tabs, type Tab } from '@/components/tabs'
import { TasksView } from '@/components/tasks-view'

const route = getRouteApi('/archive/$changeId')

export function ArchiveView() {
  const { changeId } = route.useParams()

  const { data: change, isLoading } = useArchiveSubscription(changeId)
  // TODO: raw 订阅暂未实现，后续可以添加
  const raw = null as { proposal: string; tasks?: string } | null

  const tabs = useMemo<Tab[]>(() => {
    const result: Tab[] = [
      {
        id: 'proposal',
        label: 'proposal.md',
        icon: <FileText className="w-4 h-4" />,
        content: raw?.proposal ? (
          <div className="h-full border border-border rounded-lg">
            <MarkdownViewer markdown={raw.proposal} />
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground border border-border rounded-lg">
            <p>proposal.md not found.</p>
          </div>
        ),
      },
    ]

    if (change?.tasks && change.tasks.length > 0) {
      result.push({
        id: 'tasks',
        label: 'Tasks',
        icon: <ListTodo className="w-4 h-4" />,
        content: (
          <div className="h-full border border-border rounded-lg p-4 overflow-auto">
            <TasksView tasks={change.tasks} progress={change.progress} readonly />
          </div>
        ),
      })
    }

    return result
  }, [raw, change])

  if (isLoading) {
    return <div className="animate-pulse">Loading archived change...</div>
  }

  if (!change) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Archived change not found: {changeId}</p>
        <Link to="/archive" className="text-primary hover:underline mt-4 inline-block">
          Back to Archive
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/archive"
          className="p-2 hover:bg-muted rounded-md transition-colors"
          title="Back to Archive"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <Archive className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">{change.name}</h1>
            <p className="text-sm text-muted-foreground">{changeId}</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <span className="text-green-600">
          Completed: {change.progress.completed}/{change.progress.total} tasks
        </span>
      </div>

      {/* Tabs with Activity for state preservation */}
      <Tabs tabs={tabs} defaultTab="proposal" />
    </div>
  )
}
