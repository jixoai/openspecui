import type { ArtifactStatus } from '@openspecui/core'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { useOpsxArtifactOutputSubscription, useOpsxGlobArtifactFilesSubscription } from '@/lib/use-opsx'
import { AlertTriangle, CheckCircle2, Circle, FileText, Loader2 } from 'lucide-react'

function isGlobPattern(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[')
}

interface Props {
  changeId: string
  artifact: ArtifactStatus
}

const statusConfig: Record<ArtifactStatus['status'], { label: string; className: string; icon: typeof Circle }> = {
  done: { label: 'Done', className: 'text-emerald-500', icon: CheckCircle2 },
  ready: { label: 'Ready', className: 'text-sky-500', icon: Circle },
  blocked: { label: 'Blocked', className: 'text-amber-500', icon: AlertTriangle },
}

function ArtifactHeader({ artifact }: { artifact: ArtifactStatus }) {
  const status = statusConfig[artifact.status]
  const StatusIcon = status.icon

  return (
    <>
      <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground h-4 w-4" />
          <span className="font-medium">{artifact.id}</span>
          <span className="text-muted-foreground text-xs">{artifact.relativePath ?? artifact.outputPath}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${status.className}`} />
          <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
        </div>
      </div>

      {artifact.status === 'blocked' && artifact.missingDeps?.length ? (
        <div className="border-border flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Blocked by missing dependencies</div>
            <div className="mt-1">{artifact.missingDeps.join(', ')}</div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function SingleFileContent({ changeId, artifact }: Props) {
  const { data: content, isLoading } = useOpsxArtifactOutputSubscription(changeId, artifact.outputPath)

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Loading output...
      </div>
    )
  }

  if (content) {
    return <MarkdownViewer markdown={content} />
  }

  return (
    <div className="text-muted-foreground flex h-full items-center justify-center rounded-md border border-dashed p-6 text-sm">
      Not yet generated. Use <strong>Continue</strong> to generate this artifact.
    </div>
  )
}

function GlobContent({ changeId, artifact }: Props) {
  const { data: files, isLoading } = useOpsxGlobArtifactFilesSubscription(changeId, artifact.outputPath)

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
        Not yet generated. Use <strong>Continue</strong> to generate this artifact.
      </div>
    )
  }

  return (
    <MarkdownViewer
      markdown={({ H1, Section }) => (
        <div className="space-y-6">
          {files.map((file) => (
            <Section key={file.path}>
              <H1>{file.path}</H1>
              <div className="border-border bg-muted/30 mt-2 rounded-lg border p-4 [zoom:0.86]">
                <MarkdownViewer markdown={file.content} />
              </div>
            </Section>
          ))}
        </div>
      )}
    />
  )
}

export function ArtifactOutputViewer({ changeId, artifact }: Props) {
  const isGlob = isGlobPattern(artifact.outputPath)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 py-4">
      <ArtifactHeader artifact={artifact} />
      <div className="min-h-0 flex-1">
        {isGlob ? (
          <GlobContent changeId={changeId} artifact={artifact} />
        ) : (
          <SingleFileContent changeId={changeId} artifact={artifact} />
        )}
      </div>
    </div>
  )
}
