import { FolderEditorViewer } from '@/components/folder-editor-viewer'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Tabs, type Tab } from '@/components/tabs'
import { useArchiveSubscription } from '@/lib/use-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import {
  getSharedElementBinding,
  readSharedElementHandoffState,
} from '@/lib/view-transitions/shared-elements'
import { useRoutedCarouselTabs } from '@/lib/view-transitions/tabs'
import type { OpsxEntityArtifact, OpsxEntityDetail, OpsxEntityFile } from '@openspecui/core'
import { getRouteApi, useLocation } from '@tanstack/react-router'
import { AlertTriangle, Archive, ArrowLeft, FileText, FolderTree } from 'lucide-react'
import { useMemo, useRef } from 'react'

const route = getRouteApi('/archive/$changeId')

function getArchiveTitle(entity: OpsxEntityDetail | null | undefined, fallbackId: string): string {
  return entity?.id ?? fallbackId
}

function fileCountLabel(files: readonly OpsxEntityFile[]): string {
  const count = files.filter((file) => file.type === 'file').length
  return `${count} ${count === 1 ? 'file' : 'files'}`
}

function MarkdownFilesViewer({
  files,
  emptyMessage,
}: {
  files: readonly OpsxEntityFile[]
  emptyMessage: string
}) {
  const markdownFiles = files.filter(
    (file) => file.type === 'file' && file.content !== undefined && file.path.endsWith('.md')
  )

  if (markdownFiles.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center rounded-md border border-dashed p-6 text-sm">
        {emptyMessage}
      </div>
    )
  }

  if (markdownFiles.length === 1) {
    const file = markdownFiles[0]!
    return <MarkdownViewer markdown={file.content ?? ''} path={file.path} />
  }

  return (
    <MarkdownViewer
      markdown={({ H1, Section }) => (
        <div className="space-y-6">
          {markdownFiles.map((file) => (
            <Section key={file.path}>
              <H1>{file.path}</H1>
              <div className="border-border bg-muted/30 mt-2 rounded-md border p-4 [zoom:0.86]">
                <MarkdownViewer markdown={file.content ?? ''} path={file.path} />
              </div>
            </Section>
          ))}
        </div>
      )}
    />
  )
}

function ArtifactMarkdown({ artifact }: { artifact: OpsxEntityArtifact }) {
  return (
    <MarkdownFilesViewer
      files={artifact.files}
      emptyMessage="No Markdown files matched this artifact."
    />
  )
}

function EntityMarkdown({ files }: { files: readonly OpsxEntityFile[] }) {
  return (
    <MarkdownFilesViewer
      files={files}
      emptyMessage="No Markdown files found. Open the folder view to inspect archived files."
    />
  )
}

function DiagnosticsPanel({ entity }: { entity: OpsxEntityDetail }) {
  if (entity.diagnostics.length === 0) return null

  return (
    <div className="border-border bg-muted/20 flex flex-col gap-2 rounded-md border p-3 text-sm">
      {entity.diagnostics.map((diagnostic, index) => (
        <div key={`${diagnostic.message}-${index}`} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <div className="font-medium capitalize">{diagnostic.level}</div>
            <div className="text-muted-foreground">
              {diagnostic.path ? `${diagnostic.path}: ` : ''}
              {diagnostic.message}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ArchiveView() {
  const { changeId } = route.useParams()
  const location = useLocation()

  const { data: entity, isLoading } = useArchiveSubscription(changeId)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const sharedDescriptor = useMemo(
    () => ({ family: 'archive', entityId: changeId }) as const,
    [changeId]
  )
  const handoff = readSharedElementHandoffState(location.state)
  const tabs = useMemo<Tab[]>(() => {
    if (!entity) return []

    const artifactTabs = entity.artifacts
      .filter((artifact) => artifact.files.length > 0)
      .map<Tab>((artifact) => ({
        id: `artifact:${artifact.id}`,
        label: artifact.id,
        icon: <FileText className="h-4 w-4" />,
        content: (
          <div className="flex min-h-0 flex-1 flex-col gap-3 py-4">
            <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="font-medium">{artifact.id}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {artifact.outputPath}
                </span>
              </div>
              <span className="text-muted-foreground text-xs">
                {fileCountLabel(artifact.files)}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <ArtifactMarkdown artifact={artifact} />
            </div>
          </div>
        ),
      }))

    const result: Tab[] =
      artifactTabs.length > 0
        ? artifactTabs
        : [
            {
              id: 'content',
              label: 'Content',
              icon: <FileText className="h-4 w-4" />,
              content: (
                <div className="min-h-0 flex-1 py-4">
                  <EntityMarkdown files={entity.files} />
                </div>
              ),
            },
          ]

    result.push({
      id: 'folder',
      label: 'Folder',
      icon: <FolderTree className="h-4 w-4" />,
      content: <FolderEditorViewer changeId={changeId} archived files={entity.files} />,
    })

    return result
  }, [entity, changeId])

  const { tabsRef, selectedTab, onTabChange } = useRoutedCarouselTabs({
    queryKey: 'archiveTab',
    tabs,
    initialTab: tabs[0]?.id,
  })

  if (isLoading || entity === undefined) {
    if (handoff) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
          <div className="flex items-center gap-4">
            <VTLink
              to="/archive"
              vt={{ source: headerRef, sharedElements: sharedDescriptor }}
              className="hover:bg-muted rounded-md p-2 transition-colors"
              title="Back to Archive"
            >
              <ArrowLeft className="h-5 w-5" />
            </VTLink>
            <div ref={headerRef} {...getSharedElementBinding(sharedDescriptor, 'container')}>
              <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
                <Archive
                  {...getSharedElementBinding(sharedDescriptor, 'icon')}
                  className="h-6 w-6 shrink-0"
                />
                <span {...getSharedElementBinding(sharedDescriptor, 'title')}>
                  {handoff.title ?? changeId}
                </span>
              </h1>
              <p className="text-muted-foreground text-sm">{handoff.subtitle ?? changeId}</p>
            </div>
          </div>
          <div className="vt-detail-content route-loading animate-pulse rounded-lg border p-4">
            Loading archived entity...
          </div>
        </div>
      )
    }

    return <div className="route-loading animate-pulse">Loading archived entity...</div>
  }

  if (!entity) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Archived change not found: {changeId}</p>
        <VTLink to="/archive" className="text-primary mt-4 inline-block hover:underline">
          Back to Archive
        </VTLink>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <VTLink
          to="/archive"
          vt={{ source: headerRef, sharedElements: sharedDescriptor }}
          className="hover:bg-muted rounded-md p-2 transition-colors"
          title="Back to Archive"
        >
          <ArrowLeft className="h-5 w-5" />
        </VTLink>
        <div ref={headerRef} {...getSharedElementBinding(sharedDescriptor, 'container')}>
          <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
            <Archive
              {...getSharedElementBinding(sharedDescriptor, 'icon')}
              className="h-6 w-6 shrink-0"
            />
            <span {...getSharedElementBinding(sharedDescriptor, 'title')}>
              {getArchiveTitle(entity, changeId)}
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">
            {entity.schemaName ? `Schema: ${entity.schemaName}` : 'Schema: unknown'} ·{' '}
            {fileCountLabel(entity.files)}
          </p>
        </div>
      </div>

      <DiagnosticsPanel entity={entity} />

      <div className="vt-detail-content flex min-h-0 flex-1 flex-col">
        <Tabs
          ref={tabsRef}
          tabs={tabs}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          className="min-h-0 flex-1 gap-6"
        />
      </div>
    </div>
  )
}
