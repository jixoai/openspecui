import { MarkdownViewer } from '@/components/markdown-viewer'
import {
  useOpsxArtifactOutputSubscription,
  useOpsxGlobArtifactFilesSubscription,
} from '@/lib/use-opsx'
import { useConfigSubscription } from '@/lib/use-subscription'
import type { ArtifactStatus, OpsxEntityArtifactFile, OpsxEntityFile } from '@openspecui/core'
import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { OpsxArtifactDocumentShell } from './artifact-document-shell'
import { MarkdownFilesContent, fileCountLabel } from './opsx-markdown-files-viewer'

function isGlobPattern(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[')
}

export interface ArtifactOutputDescriptor {
  id: string
  outputPath: string
  status?: ArtifactStatus['status']
  missingDeps?: readonly string[]
  relativePath?: string
  files?: readonly OpsxEntityArtifactFile[]
}

export interface DocumentContentFallbackDescriptor {
  id?: string
  label?: string
  outputPath?: string
  relativePath?: string
  files: readonly OpsxEntityFile[]
  emptyMessage: string
}

interface Props {
  changeId: string
  artifact: ArtifactOutputDescriptor
}

function ArtifactOutputDocumentShell({
  artifact,
  children,
}: {
  artifact: ArtifactOutputDescriptor
  children: ReactNode
}) {
  return (
    <OpsxArtifactDocumentShell
      id={artifact.id}
      path={artifact.relativePath ?? artifact.outputPath}
      status={artifact.status}
      missingDeps={artifact.missingDeps}
    >
      {children}
    </OpsxArtifactDocumentShell>
  )
}

function ArtifactFilesDocumentShell({
  artifact,
  files,
  translationConfig,
}: {
  artifact: Props['artifact']
  files: readonly OpsxEntityArtifactFile[]
  translationConfig?: DocumentTranslationConfig
}) {
  return (
    <MarkdownViewer
      markdown={(components) => (
        <OpsxArtifactDocumentShell
          id={artifact.id}
          path={artifact.relativePath ?? artifact.outputPath}
          meta={
            <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1.5 text-xs font-medium">
              {fileCountLabel(files)}
            </span>
          }
        >
          <MarkdownFilesContent
            components={components}
            files={files}
            emptyMessage="No Markdown files matched this artifact."
            translationConfig={translationConfig}
          />
        </OpsxArtifactDocumentShell>
      )}
      path={artifact.relativePath ?? artifact.outputPath}
      translationConfig={translationConfig}
    />
  )
}

function FallbackDocumentShell({
  fallback,
  translationConfig,
}: {
  fallback: DocumentContentFallbackDescriptor
  translationConfig?: DocumentTranslationConfig
}) {
  return (
    <MarkdownViewer
      markdown={(components) => (
        <OpsxArtifactDocumentShell
          id={fallback.id ?? fallback.label ?? 'Content'}
          path={fallback.relativePath ?? fallback.outputPath}
          meta={
            <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1.5 text-xs font-medium">
              {fileCountLabel(fallback.files)}
            </span>
          }
        >
          <MarkdownFilesContent
            components={components}
            files={fallback.files}
            emptyMessage={fallback.emptyMessage}
            translationConfig={translationConfig}
          />
        </OpsxArtifactDocumentShell>
      )}
      path={fallback.relativePath ?? fallback.outputPath}
      translationConfig={translationConfig}
    />
  )
}

function SingleFileContent({
  changeId,
  artifact,
  translationConfig,
}: Props & { translationConfig?: DocumentTranslationConfig }) {
  const { data: content, isLoading } = useOpsxArtifactOutputSubscription(
    changeId,
    artifact.outputPath
  )

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Loading output...
      </div>
    )
  }

  if (content) {
    return (
      <MarkdownViewer
        markdown={() => (
          <ArtifactOutputDocumentShell artifact={artifact}>
            <MarkdownViewer
              markdown={content}
              path={artifact.outputPath}
              translationConfig={translationConfig}
            />
          </ArtifactOutputDocumentShell>
        )}
        path={artifact.outputPath}
        translationConfig={translationConfig}
      />
    )
  }

  return (
    <div className="text-muted-foreground flex h-full items-center justify-center rounded-md border border-dashed p-6 text-sm">
      Not yet generated. Use <strong className="mx-2 font-bold">Continue</strong> to generate this
      artifact.
    </div>
  )
}

function GlobContent({
  changeId,
  artifact,
  translationConfig,
}: Props & { translationConfig?: DocumentTranslationConfig }) {
  const { data: files, isLoading } = useOpsxGlobArtifactFilesSubscription(
    changeId,
    artifact.outputPath
  )

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!files?.length) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center rounded-md border border-dashed p-6 text-sm">
        Not yet generated. Use <strong className="mx-2 font-bold">Continue</strong> to generate this
        artifact.
      </div>
    )
  }

  return (
    <MarkdownViewer
      markdown={({ H1, Section }) => (
        <ArtifactOutputDocumentShell artifact={artifact}>
          <div className="space-y-6">
            {files.map((file) => (
              <Section key={file.path}>
                <H1>{file.path}</H1>
                <div className="border-border bg-muted/30 mt-2 rounded-lg border p-4 [zoom:0.86]">
                  <MarkdownViewer
                    markdown={file.content}
                    path={file.path}
                    translationConfig={translationConfig}
                  />
                </div>
              </Section>
            ))}
          </div>
        </ArtifactOutputDocumentShell>
      )}
    />
  )
}

export function ArtifactOutputViewer({ changeId, artifact }: Props) {
  const { data: config } = useConfigSubscription()

  if (artifact.files) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <ArtifactFilesDocumentShell
            artifact={artifact}
            files={artifact.files}
            translationConfig={config?.translation}
          />
        </div>
      </div>
    )
  }

  return (
    <LiveArtifactOutputViewer
      changeId={changeId}
      artifact={artifact}
      translationConfig={config?.translation}
    />
  )
}

export function ContentFallbackViewer({
  fallback,
}: {
  fallback: DocumentContentFallbackDescriptor
}) {
  const { data: config } = useConfigSubscription()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <FallbackDocumentShell fallback={fallback} translationConfig={config?.translation} />
      </div>
    </div>
  )
}

function LiveArtifactOutputViewer({
  changeId,
  artifact,
  translationConfig,
}: Props & { translationConfig?: DocumentTranslationConfig }) {
  const isGlob = isGlobPattern(artifact.outputPath)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        {isGlob ? (
          <GlobContent
            changeId={changeId}
            artifact={artifact}
            translationConfig={translationConfig}
          />
        ) : (
          <SingleFileContent
            changeId={changeId}
            artifact={artifact}
            translationConfig={translationConfig}
          />
        )}
      </div>
    </div>
  )
}
