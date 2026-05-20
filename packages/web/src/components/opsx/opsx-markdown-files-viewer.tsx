import { MarkdownViewer } from '@/components/markdown-viewer'
import type { OpsxEntityFile } from '@openspecui/core'
import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import type { ReactNode } from 'react'

interface MarkdownBuilderComponents {
  H1: (props: { children?: ReactNode }) => ReactNode
  Section: (props: { children?: ReactNode }) => ReactNode
}

function getMarkdownFiles(files: readonly OpsxEntityFile[]) {
  return files.filter(
    (file) => file.type === 'file' && file.content !== undefined && file.path.endsWith('.md')
  )
}

export function fileCountLabel(files: readonly OpsxEntityFile[]): string {
  const count = files.filter((file) => file.type === 'file').length
  return `${count} ${count === 1 ? 'file' : 'files'}`
}

export function MarkdownFilesContent({
  components,
  files,
  emptyMessage,
  translationConfig,
}: {
  components: MarkdownBuilderComponents
  files: readonly OpsxEntityFile[]
  emptyMessage: string
  translationConfig?: DocumentTranslationConfig
}) {
  const markdownFiles = getMarkdownFiles(files)

  if (markdownFiles.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center rounded-md border border-dashed p-6 text-sm">
        {emptyMessage}
      </div>
    )
  }

  if (markdownFiles.length === 1) {
    const file = markdownFiles[0]!
    return (
      <MarkdownViewer
        markdown={file.content ?? ''}
        path={file.path}
        translationConfig={translationConfig}
      />
    )
  }

  const { H1, Section } = components

  return (
    <div className="space-y-6">
      {markdownFiles.map((file) => (
        <Section key={file.path}>
          <H1>{file.path}</H1>
          <div className="border-border bg-muted/30 mt-2 rounded-lg border p-4 [zoom:0.86]">
            <MarkdownViewer
              markdown={file.content ?? ''}
              path={file.path}
              translationConfig={translationConfig}
            />
          </div>
        </Section>
      ))}
    </div>
  )
}

export function MarkdownFilesViewer({
  files,
  emptyMessage,
  translationConfig,
}: {
  files: readonly OpsxEntityFile[]
  emptyMessage: string
  translationConfig?: DocumentTranslationConfig
}) {
  return (
    <MarkdownViewer
      markdown={(components) => (
        <MarkdownFilesContent
          components={components}
          files={files}
          emptyMessage={emptyMessage}
          translationConfig={translationConfig}
        />
      )}
    />
  )
}
