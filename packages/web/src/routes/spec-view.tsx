import { SpecMarkdownDocument } from '@/components/spec-markdown-document'
import { useSpecRawSubscription, useSpecSubscription } from '@/lib/use-subscription'
import { VTLink } from '@/lib/view-transitions/navigation'
import {
  getSharedElementBinding,
  readSharedElementHandoffState,
} from '@/lib/view-transitions/shared-elements'
import type { Spec } from '@openspecui/core'
import { useLocation, useParams } from '@tanstack/react-router'
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle, FileText, Info } from 'lucide-react'
import { useMemo, useRef } from 'react'

export function SpecView() {
  const { specId } = useParams({ from: '/specs/$specId' })
  const location = useLocation()
  const handoff = readSharedElementHandoffState(location.state)
  const sharedDescriptor = useMemo(() => ({ family: 'specs', entityId: specId }) as const, [specId])

  const { data: spec, isLoading } = useSpecSubscription(specId)
  const { data: rawMarkdown, isLoading: isRawLoading } = useSpecRawSubscription(specId)
  // TODO: validation 暂时不支持订阅，后续可以添加
  const validation = null as {
    valid: boolean
    issues: Array<{ severity: string; message: string; path?: string }>
  } | null

  if ((isLoading && !spec) || (isRawLoading && !rawMarkdown)) {
    if (handoff) {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
          <div className="flex items-center gap-4">
            <VTLink
              to="/specs"
              vt={{ sharedElements: sharedDescriptor }}
              className="hover:bg-muted rounded-md p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </VTLink>
            <div {...getSharedElementBinding(sharedDescriptor, 'container')}>
              <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
                <FileText
                  {...getSharedElementBinding(sharedDescriptor, 'icon')}
                  className="h-6 w-6 shrink-0"
                />
                <span {...getSharedElementBinding(sharedDescriptor, 'title')}>
                  {handoff.title ?? specId}
                </span>
              </h1>
              <p className="text-muted-foreground">ID: {handoff.subtitle ?? specId}</p>
            </div>
          </div>
          <div className="vt-detail-content route-loading animate-pulse rounded-lg border p-4">
            Loading spec...
          </div>
        </div>
      )
    }

    return <div className="route-loading animate-pulse">Loading spec...</div>
  }

  if (!spec) {
    return <div className="text-red-600">Spec not found</div>
  }

  return <SpecContent spec={spec} rawMarkdown={rawMarkdown ?? ''} validation={validation} />
}

function SpecContent({
  spec,
  rawMarkdown,
  validation,
}: {
  spec: Spec
  rawMarkdown: string
  validation: {
    valid: boolean
    issues: Array<{ severity: string; message: string; path?: string }>
  } | null
}) {
  const headerRef = useRef<HTMLDivElement | null>(null)
  const sharedDescriptor = useMemo(
    () => ({ family: 'specs', entityId: spec.id }) as const,
    [spec.id]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <VTLink
          to="/specs"
          vt={{ source: headerRef, sharedElements: sharedDescriptor }}
          className="hover:bg-muted rounded-md p-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </VTLink>
        <div ref={headerRef} {...getSharedElementBinding(sharedDescriptor, 'container')}>
          <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
            <FileText
              {...getSharedElementBinding(sharedDescriptor, 'icon')}
              className="h-6 w-6 shrink-0"
            />
            <span {...getSharedElementBinding(sharedDescriptor, 'title')}>{spec.name}</span>
          </h1>
          <p className="text-muted-foreground">ID: {spec.id}</p>
        </div>
      </div>

      {validation && <ValidationStatus validation={validation} />}

      <SpecMarkdownDocument
        markdown={rawMarkdown}
        requirementCount={spec.requirements.length}
        className="vt-detail-content min-h-0 flex-1"
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
