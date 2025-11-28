import { Activity, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { trpc, trpcClient } from '@/lib/trpc'
import { useRealtimeUpdates } from '@/lib/use-realtime'
import { FileText, Bot, Save, X, Edit2 } from 'lucide-react'
import { MarkdownViewer } from '@/components/markdown-viewer'

type ActiveTab = 'project' | 'agents'

export function Project() {
  useRealtimeUpdates()

  const [activeTab, setActiveTab] = useState<ActiveTab>('project')
  const [editingTab, setEditingTab] = useState<ActiveTab | null>(null)
  const [editContent, setEditContent] = useState('')

  const {
    data: projectMd,
    isLoading: projectLoading,
    refetch: refetchProject,
  } = useQuery(trpc.project.getProjectMd.queryOptions())
  const {
    data: agentsMd,
    isLoading: agentsLoading,
    refetch: refetchAgents,
  } = useQuery(trpc.project.getAgentsMd.queryOptions())

  const saveProjectMutation = useMutation({
    mutationFn: (content: string) => trpcClient.project.saveProjectMd.mutate({ content }),
    onSuccess: () => {
      refetchProject()
      setEditingTab(null)
    },
  })

  const saveAgentsMutation = useMutation({
    mutationFn: (content: string) => trpcClient.project.saveAgentsMd.mutate({ content }),
    onSuccess: () => {
      refetchAgents()
      setEditingTab(null)
    },
  })

  const currentContent = activeTab === 'project' ? projectMd : agentsMd
  const saveMutation = activeTab === 'project' ? saveProjectMutation : saveAgentsMutation
  const isEditing = editingTab === activeTab

  const handleEdit = () => {
    setEditContent(currentContent || '')
    setEditingTab(activeTab)
  }

  const handleSave = () => {
    saveMutation.mutate(editContent)
  }

  const handleCancel = () => {
    setEditingTab(null)
    setEditContent('')
  }

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'project', label: 'project.md', icon: <FileText className="w-4 h-4" /> },
    { id: 'agents', label: 'AGENTS.md', icon: <Bot className="w-4 h-4" /> },
  ]

  const descriptions: Record<ActiveTab, React.ReactNode> = {
    project: (
      <p>
        <strong>project.md</strong> defines project context, tech stack, and conventions for AI
        assistants.
      </p>
    ),
    agents: (
      <p>
        <strong>AGENTS.md</strong> provides workflow instructions for AI coding assistants using
        OpenSpec.
      </p>
    ),
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Project</h1>
        {!isEditing && currentContent && (
          <button
            onClick={handleEdit}
            className="border-border flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-border flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content with Activity for state preservation */}
      <div className="border-border min-h-0 flex-1 overflow-hidden rounded-lg border">
        <Activity mode={activeTab === 'project' ? 'visible' : 'hidden'}>
          <TabContent
            content={projectMd}
            isLoading={projectLoading}
            isEditing={editingTab === 'project'}
            editContent={editContent}
            setEditContent={setEditContent}
            onCancel={handleCancel}
            onSave={handleSave}
            savePending={saveProjectMutation.isPending}
            tabName="project.md"
            defaultContent="# Project Context\n\n## Purpose\n\n## Tech Stack\n\n## Conventions\n"
            onStartEdit={() => {
              setEditContent(projectMd || '')
              setEditingTab('project')
            }}
          />
        </Activity>
        <Activity mode={activeTab === 'agents' ? 'visible' : 'hidden'}>
          <TabContent
            content={agentsMd}
            isLoading={agentsLoading}
            isEditing={editingTab === 'agents'}
            editContent={editContent}
            setEditContent={setEditContent}
            onCancel={handleCancel}
            onSave={handleSave}
            savePending={saveAgentsMutation.isPending}
            tabName="AGENTS.md"
            defaultContent="# AI Agent Instructions\n\n## Workflow\n\n## Commands\n"
            onStartEdit={() => {
              setEditContent(agentsMd || '')
              setEditingTab('agents')
            }}
          />
        </Activity>
      </div>

      {/* Description */}
      <div className="text-muted-foreground text-sm">{descriptions[activeTab]}</div>
    </div>
  )
}

interface TabContentProps {
  content: string | null | undefined
  isLoading: boolean
  isEditing: boolean
  editContent: string
  setEditContent: (content: string) => void
  onCancel: () => void
  onSave: () => void
  savePending: boolean
  tabName: string
  defaultContent: string
  onStartEdit: () => void
}

function TabContent({
  content,
  isLoading,
  isEditing,
  editContent,
  setEditContent,
  onCancel,
  onSave,
  savePending,
  tabName,
  defaultContent,
  onStartEdit,
}: TabContentProps) {
  if (isLoading) {
    return <div className="animate-pulse p-4">Loading...</div>
  }

  if (!content) {
    return (
      <div className="text-muted-foreground p-8 text-center">
        <p className="mb-4">{tabName} not found.</p>
        <button
          onClick={() => {
            setEditContent(defaultContent)
            onStartEdit()
          }}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 hover:opacity-90"
        >
          Create {tabName}
        </button>
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-border bg-muted/30 flex items-center justify-between border-b p-2">
          <span className="px-2 text-sm font-medium">Editing {tabName}</span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="border-border flex items-center gap-1 rounded border px-3 py-1 text-sm hover:bg-muted"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={savePending}
              className="bg-primary text-primary-foreground flex items-center gap-1 rounded px-3 py-1 text-sm hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3 w-3" />
              {savePending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="bg-background flex-1 resize-none p-4 font-mono text-sm focus:outline-none"
          spellCheck={false}
        />
      </div>
    )
  }

  return <MarkdownViewer markdown={content} />
}
