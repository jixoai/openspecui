import { MarkdownViewer } from '@/components/markdown-viewer'
import {
  useOpsxArtifactOutputSubscription,
  useOpsxGlobArtifactFilesSubscription,
} from '@/lib/use-opsx'
import { useConfigSubscription } from '@/lib/use-subscription'
import type { ArtifactStatus } from '@openspecui/core'
import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

function isGlobPattern(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[')
}

interface Props {
  changeId: string
  artifact: ArtifactStatus
}

const statusConfig: Record<
  ArtifactStatus['status'],
  { label: string; className: string; icon: typeof Circle }
> = {
  done: { label: 'Done', className: 'text-emerald-500', icon: CheckCircle2 },
  ready: { label: 'Ready', className: 'text-sky-500', icon: Circle },
  blocked: { label: 'Blocked', className: 'text-amber-500', icon: AlertTriangle },
}

function ArtifactDocumentHeader({ artifact }: { artifact: ArtifactStatus }) {
  const status = statusConfig[artifact.status]
  const StatusIcon = status.icon

  return (
    <section className="border-border bg-muted/25 mb-5 rounded-md border px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="font-medium">{artifact.id}</div>
          <div className="text-muted-foreground break-all text-xs">
            {artifact.relativePath ?? artifact.outputPath}
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${status.className}`}
        >
          <StatusIcon className="h-4 w-4" />
          {status.label}
        </span>
      </div>
      {artifact.status === 'blocked' && artifact.missingDeps?.length ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Blocked by missing dependencies</div>
            <div className="mt-1">{artifact.missingDeps.join(', ')}</div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ArtifactDocumentShell({
  artifact,
  children,
}: {
  artifact: ArtifactStatus
  children: ReactNode
}) {
  return (
    <>
      <ArtifactDocumentHeader artifact={artifact} />
      {children}
    </>
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
          <ArtifactDocumentShell artifact={artifact}>
            <MarkdownViewer
              markdown={content}
              path={artifact.outputPath}
              translationConfig={translationConfig}
            />
          </ArtifactDocumentShell>
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
        <ArtifactDocumentShell artifact={artifact}>
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
        </ArtifactDocumentShell>
      )}
    />
  )
}

export function ArtifactOutputViewer({ changeId, artifact }: Props) {
  const isGlob = isGlobPattern(artifact.outputPath)
  const { data: config } = useConfigSubscription()

  return (
    <div className="flex min-h-0 flex-1 flex-col py-4">
      <div className="min-h-0 flex-1">
        {isGlob ? (
          <GlobContent
            changeId={changeId}
            artifact={artifact}
            translationConfig={config?.translation}
          />
        ) : (
          <SingleFileContent
            changeId={changeId}
            artifact={artifact}
            translationConfig={config?.translation}
          />
        )}
      </div>
    </div>
  )
}
