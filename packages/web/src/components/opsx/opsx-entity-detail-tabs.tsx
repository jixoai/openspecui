import { FolderEditorViewer } from '@/components/folder-editor-viewer'
import type { Tab } from '@/components/tabs'
import type { OpsxEntityFile } from '@openspecui/core'
import { FileText, FolderTree } from 'lucide-react'
import { OpsxArtifactTabStatusIcon } from './artifact-document-shell'
import {
  ArtifactOutputViewer,
  ContentFallbackViewer,
  type ArtifactOutputDescriptor,
} from './artifact-output-viewer'

export interface OpsxEntityDetailFolder {
  changeId: string
  archived?: boolean
  files?: OpsxEntityFile[]
}

export interface OpsxEntityDetailContentFallback {
  id?: string
  label?: string
  outputPath?: string
  relativePath?: string
  files: readonly OpsxEntityFile[]
  emptyMessage: string
}

function createArtifactTab(
  folder: OpsxEntityDetailFolder,
  artifact: ArtifactOutputDescriptor
): Tab {
  return {
    id: artifact.files ? `artifact:${artifact.id}` : artifact.id,
    label: artifact.id,
    icon: artifact.status ? (
      <OpsxArtifactTabStatusIcon status={artifact.status} />
    ) : (
      <FileText className="h-4 w-4" />
    ),
    content: <ArtifactOutputViewer changeId={folder.changeId} artifact={artifact} />,
  }
}

function createContentFallbackTab(contentFallback: OpsxEntityDetailContentFallback): Tab {
  return {
    id: 'content',
    label: contentFallback.label ?? 'Content',
    icon: <FileText className="h-4 w-4" />,
    content: <ContentFallbackViewer fallback={contentFallback} />,
  }
}

function createFolderTab(folder: OpsxEntityDetailFolder): Tab {
  return {
    id: 'folder',
    label: 'Folder',
    icon: <FolderTree className="h-4 w-4" />,
    content: (
      <FolderEditorViewer
        changeId={folder.changeId}
        archived={folder.archived}
        files={folder.files}
      />
    ),
  }
}

export function buildOpsxEntityDetailTabs({
  artifacts,
  hideEmptyArtifacts,
  contentFallback,
  folder,
}: {
  artifacts: readonly ArtifactOutputDescriptor[]
  hideEmptyArtifacts: boolean
  contentFallback?: OpsxEntityDetailContentFallback
  folder: OpsxEntityDetailFolder
}): Tab[] {
  const visibleArtifacts = hideEmptyArtifacts
    ? artifacts.filter((artifact) => (artifact.files?.length ?? 0) > 0)
    : artifacts

  const primaryTabs =
    visibleArtifacts.length > 0
      ? visibleArtifacts.map((artifact) => createArtifactTab(folder, artifact))
      : contentFallback
        ? [createContentFallbackTab(contentFallback)]
        : []

  return [...primaryTabs, createFolderTab(folder)]
}
