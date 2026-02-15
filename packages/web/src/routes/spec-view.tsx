import { MarkdownViewer } from '@/components/markdown-viewer'
import { useSpecSubscription } from '@/lib/use-subscription'
import type { Spec } from '@openspecui/core'
import { Link, useParams } from '@tanstack/react-router'
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle, FileText, Info } from 'lucide-react'

export function SpecView() {
  const { specId } = useParams({ from: '/specs/$specId' })

  const { data: spec, isLoading } = useSpecSubscription(specId)
  // TODO: validation 暂时不支持订阅，后续可以添加
  const validation = null as {
    valid: boolean
    issues: Array<{ severity: string; message: string; path?: string }>
  } | null

  if (isLoading && !spec) {
    return <div className="route-loading animate-pulse">Loading spec...</div>
  }

  if (!spec) {
    return <div className="text-red-600">Spec not found</div>
  }

  return <SpecContent spec={spec} validation={validation} />
}

function SpecContent({
  spec,
  validation,
}: {
  spec: Spec
  validation: {
    valid: boolean
    issues: Array<{ severity: string; message: string; path?: string }>
  } | null
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <Link to="/specs" className="hover:bg-muted rounded-md p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
            <FileText className="h-6 w-6 shrink-0" />
            {spec.name}
          </h1>
          <p className="text-muted-foreground">ID: {spec.id}</p>
        </div>
      </div>

      {validation && <ValidationStatus validation={validation} />}

      <MarkdownViewer
        className="min-h-0 flex-1"
        markdown={({ H1, H2, Section }) => (
          <div className="space-y-6">
            {/* Overview */}
            <Section>
              <H1 id="overview">Overview</H1>
              <div className="bg-muted/30 mt-2 rounded-lg p-4">
                {spec.overview ? (
                  <MarkdownViewer markdown={spec.overview} />
                ) : (
                  <span className="text-muted-foreground">No overview</span>
                )}
              </div>
            </Section>

            {/* Requirements */}
            <Section>
              <H1 id="requirements">Requirements ({spec.requirements.length})</H1>
              <div className="mt-3 space-y-4">
                {spec.requirements.map((req) => (
                  <Section key={req.id} className="border-border rounded-lg border p-4">
                    <H2 className="text-base" id={`req-${req.id}`}>
                      {req.text}
                    </H2>
                    {req.scenarios.length > 0 && (
                      <div className="mt-3">
                        <div className="text-muted-foreground mb-2 text-sm font-medium">
                          Scenarios ({req.scenarios.length})
                        </div>
                        {req.scenarios.map((scenario, i) => {
                          // Remove leading/trailing --- separators
                          const content = scenario.rawText
                            .replace(/^---\n?/, '')
                            .replace(/\n?---$/, '')
                            .trim()
                          return (
                            <div key={i} className="bg-muted/50 rounded-md p-3">
                              <MarkdownViewer markdown={content} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Section>
                ))}
                {spec.requirements.length === 0 && (
                  <div className="text-muted-foreground">No requirements defined</div>
                )}
              </div>
            </Section>
          </div>
        )}
      />
    </div>
  )
}

function ValidationStatus({
  validation,
}: {
  validation: {
    valid: boolean
    issues: Array<{ severity: string; message: string; path?: string }>
  }
}) {
  const errors = validation.issues.filter((i) => i.severity === 'ERROR')
  const warnings = validation.issues.filter((i) => i.severity === 'WARNING')
  const infos = validation.issues.filter((i) => i.severity === 'INFO')

  return (
    <div
      className={`flex rounded-lg border p-4 ${validation.valid ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}
    >
      <div className="align-content flex gap-2">
        {validation.valid ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <AlertCircle className="h-5 w-5 text-red-500" />
        )}
        <span className={`font-medium ${validation.valid ? 'text-green-600' : 'text-red-600'}`}>
          {validation.valid ? 'Validation Passed' : 'Validation Failed'}
        </span>
      </div>

      {validation.issues.length > 0 && (
        <div className="space-y-1 text-sm">
          {errors.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}
          {warnings.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-yellow-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}
          {infos.map((issue, i) => (
            <div key={i} className="text-muted-foreground flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
