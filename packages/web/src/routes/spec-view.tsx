import { MarkdownContent } from '@/components/markdown-content'
import { MarkdownViewer } from '@/components/markdown-viewer'
import { Toc, TocSection, type TocItem } from '@/components/toc'
import { trpc } from '@/lib/trpc'
import { useSpecRealtimeUpdates } from '@/lib/use-realtime'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle, Info } from 'lucide-react'
import { useMemo } from 'react'

export function SpecView() {
  const { specId } = useParams({ from: '/specs/$specId' })

  // Subscribe to realtime updates for this specific spec
  useSpecRealtimeUpdates(specId)

  const { data: spec, isLoading } = useQuery(trpc.spec.get.queryOptions({ id: specId }))
  const { data: validation } = useQuery(trpc.spec.validate.queryOptions({ id: specId }))

  // Build ToC items from spec sections - must be before any conditional returns
  const tocItems = useMemo<TocItem[]>(() => {
    if (!spec) return []

    const items: TocItem[] = [{ id: 'overview', label: 'Overview', level: 1 }]

    if (spec.requirements.length > 0) {
      items.push({ id: 'requirements', label: 'Requirements', level: 1 })
      for (const req of spec.requirements) {
        // Use requirement ID as ToC item, truncate long text
        const label = req.text.length > 30 ? `${req.text.slice(0, 30)}…` : req.text
        items.push({ id: `req-${req.id}`, label, level: 2 })
      }
    }

    return items
  }, [spec])

  if (isLoading) {
    return <div className="animate-pulse">Loading spec...</div>
  }

  if (!spec) {
    return <div className="text-red-600">Spec not found</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/specs" className="hover:bg-muted rounded-md p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{spec.name}</h1>
          <p className="text-muted-foreground">ID: {spec.id}</p>
        </div>
      </div>

      {validation && <ValidationStatus validation={validation} />}

      <MarkdownViewer
        toc={<Toc items={tocItems} className="viewer-toc" />}
        tocItems={tocItems}
        className="min-h-0 flex-1"
      >
        <div className="space-y-6">
          <TocSection id="overview" index={0}>
            <h2 className="mb-2 text-lg font-semibold">Overview</h2>
            <div className="bg-muted/30 rounded-lg p-4">
              {spec.overview ? (
                <MarkdownContent>{spec.overview}</MarkdownContent>
              ) : (
                <span className="text-muted-foreground">No overview</span>
              )}
            </div>
          </TocSection>

          <TocSection id="requirements" index={1}>
            <h2 className="mb-3 text-lg font-semibold">Requirements ({spec.requirements.length})</h2>
            <div className="space-y-4">
              {spec.requirements.map((req, reqIndex) => (
                <TocSection
                  key={req.id}
                  id={`req-${req.id}`}
                  index={2 + reqIndex}
                  as="div"
                  className="border-border rounded-lg border p-4"
                >
                  <div className="mb-2 font-medium">{req.text}</div>
                  {req.scenarios.length > 0 && (
                    <div className="mt-3">
                      <div className="text-muted-foreground mb-2 text-sm font-medium">
                        Scenarios ({req.scenarios.length})
                      </div>
                      {req.scenarios.map((scenario, i) => {
                        // Remove leading/trailing --- separators that may be used for splitting
                        const content = scenario.rawText
                          .replace(/^---\n?/, '')
                          .replace(/\n?---$/, '')
                          .trim()
                        return (
                          <div key={i} className="bg-muted/50 rounded-md p-3">
                            <MarkdownContent>{content}</MarkdownContent>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TocSection>
              ))}
              {spec.requirements.length === 0 && (
                <div className="text-muted-foreground">No requirements defined</div>
              )}
            </div>
          </TocSection>
        </div>
      </MarkdownViewer>
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
