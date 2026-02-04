import { CodeEditor } from '@/components/code-editor'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Tabs, type Tab } from '@/components/tabs'
import { isStaticMode } from '@/lib/static-mode'
import { trpcClient } from '@/lib/trpc'
import { useAgentsMdSubscription, useProjectMdSubscription } from '@/lib/use-subscription'
import { useMutation } from '@tanstack/react-query'
import { Bot, Edit2, FileText, Folder, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type ActiveTab = 'project' | 'agents'

export function Project() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('project')
  const [editingTab, setEditingTab] = useState<ActiveTab | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    const id = requestAnimationFrame(() => setLoading(false))
    return () => cancelAnimationFrame(id)
  }, [])

  const { data: projectMd, isLoading: projectLoading } = useProjectMdSubscription()
  const { data: agentsMd, isLoading: agentsLoading } = useAgentsMdSubscription()

  const saveProjectMutation = useMutation({
    mutationFn: (content: string) => trpcClient.project.saveProjectMd.mutate({ content }),
    onSuccess: () => {
      // 订阅模式下无需手动 refetch，文件变更会自动触发更新
      setEditingTab(null)
    },
  })

  const saveAgentsMutation = useMutation({
    mutationFn: (content: string) => trpcClient.project.saveAgentsMd.mutate({ content }),
    onSuccess: () => {
      // 订阅模式下无需手动 refetch，文件变更会自动触发更新
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

  const tabs: Tab[] = useMemo(
    () => [
      {
        id: 'project',
        label: 'project.md',
        icon: <FileText className="h-4 w-4" />,
        content: (
          <div className="border-border h-full min-h-0 flex-1 overflow-hidden rounded-lg border">
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
          </div>
        ),
      },
      {
        id: 'agents',
        label: 'AGENTS.md',
        icon: <Bot className="h-4 w-4" />,
        content: (
          <div className="border-border h-full min-h-0 flex-1 overflow-hidden rounded-lg border">
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
          </div>
        ),
      },
    ],
    [
      agentsLoading,
      agentsMd,
      editContent,
      editingTab,
      handleCancel,
      handleSave,
      projectLoading,
      projectMd,
      saveAgentsMutation.isPending,
      saveProjectMutation.isPending,
    ]
  )

  const descriptions: Record<ActiveTab, React.ReactNode> = useMemo(
    () => ({
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
    }),
    []
  )

  if (projectLoading || agentsLoading) {
    return <div className="route-loading animate-pulse">Loading...</div>
  }

  if (loading) {
    return <div className="route-loading animate-pulse">Loading project...</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
          <Folder className="h-6 w-6 shrink-0" />
          Project
        </h1>
        {/* Hide edit button in static mode */}
        {!isStaticMode() && !isEditing && currentContent && (
          <button
            onClick={handleEdit}
            className="border-border hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
        )}
      </div>

      <Tabs
        tabs={tabs}
        selectedTab={activeTab}
        onTabChange={(id) => setActiveTab(id as ActiveTab)}
        className="min-h-0 flex-1 gap-4"
      />

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
  if (isLoading && !content) {
    return <div className="route-loading animate-pulse">Loading...</div>
  }

  if (!content) {
    return (
      <div className="text-muted-foreground p-8 text-center">
        <p className="mb-4">{tabName} not found.</p>
        {/* Hide create button in static mode */}
        {!isStaticMode() && (
          <button
            onClick={() => {
              setEditContent(defaultContent)
              onStartEdit()
            }}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 hover:opacity-90"
          >
            Create {tabName}
          </button>
        )}
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
              className="border-border hover:bg-muted flex items-center gap-1 rounded border px-3 py-1 text-sm"
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
        <CodeEditor
          value={editContent}
          onChange={setEditContent}
          filename={tabName}
          className="min-h-0 flex-1"
        />
      </div>
    )
  }

  // 只读模式：使用 CodeEditor 的只读预览
  return <MarkdownViewer markdown={content} />
}
