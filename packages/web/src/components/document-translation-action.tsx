import { Button } from '@/components/button'
import { useDocumentTranslation } from '@/lib/use-document-translation'
import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { useNavigate } from '@tanstack/react-router'
import { Languages, Loader2 } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { MarkdownInlineContent, type MarkdownBlockAnnotation } from './markdown-content'
import {
  type MarkdownHeadingTransformInput,
  type MarkdownHeadingTransformResult,
  type MarkdownRenderPluginResult,
  type MarkdownRenderProcessor,
} from './markdown-viewer'

type TranslationSegmentResult = NonNullable<
  ReturnType<typeof useDocumentTranslation>['result']
>['segments'][number]

export function useDocumentTranslationRenderPlugin({
  markdown,
  translationConfig,
}: {
  markdown: string | undefined
  translationConfig?: DocumentTranslationConfig
}): MarkdownRenderPluginResult {
  const session = useDocumentTranslation(markdown ?? '', translationConfig)
  const canTranslate =
    translationConfig !== undefined && typeof markdown === 'string' && markdown.length > 0

  const translationProjection = useMemo(
    () => createTranslationProjection(session.result),
    [session.result]
  )
  const translationAction = useMemo(
    () =>
      canTranslate ? (
        <DocumentTranslationAction
          enabled={translationConfig?.enabled ?? false}
          session={session}
        />
      ) : undefined,
    [canTranslate, session, translationConfig?.enabled]
  )

  return {
    processors: translationProjection.headingProcessor
      ? [translationProjection.headingProcessor]
      : [],
    blockAnnotations: translationProjection.blockAnnotations,
    tocHeaderActionKey: canTranslate
      ? [
          'document-translation',
          translationConfig?.enabled ? 'enabled' : 'disabled',
          translationConfig?.targetLanguage,
          translationConfig?.displayMode,
          session.status,
          hashString(markdown),
        ].join(':')
      : undefined,
    tocHeaderAction: translationAction,
  }
}

function DocumentTranslationAction({
  enabled,
  session,
}: {
  enabled: boolean
  session: ReturnType<typeof useDocumentTranslation>
}) {
  const navigate = useNavigate()

  return (
    <DocumentTranslationButton
      enabled={enabled}
      status={session.status}
      onActivate={() => {
        if (!enabled) {
          void navigate({
            to: '/settings',
            hash: 'settings-translation',
          })
          return
        }
        if (session.status === 'translating' || session.status === 'initializing') {
          session.cancel()
          return
        }
        if (session.status === 'translated') {
          session.reset()
          return
        }
        void session.start()
      }}
    />
  )
}

function hashString(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return hash.toString(36)
}

function createTranslationProjection(result: ReturnType<typeof useDocumentTranslation>['result']): {
  headingProcessor?: MarkdownRenderProcessor
  blockAnnotations: MarkdownBlockAnnotation[]
} {
  if (!result) return { blockAnnotations: [] }

  const segmentByOffset = new Map(
    result.segments
      .filter((segment) => segment.target)
      .map((segment) => [segment.sourceStartOffset, segment])
  )

  return {
    headingProcessor: {
      name: 'document-translation',
      order: Number.MAX_SAFE_INTEGER,
      transformHeading(input) {
        const segment =
          input.sourceStartOffset === undefined
            ? undefined
            : segmentByOffset.get(input.sourceStartOffset)
        if (!segment?.target || segment.kind !== 'heading') return undefined
        return createTranslatedHeadingTransform(input, segment, result.displayMode)
      },
    },
    blockAnnotations: result.segments
      .filter((segment) => segment.target && segment.kind !== 'heading')
      .map(
        (segment): MarkdownBlockAnnotation => ({
          sourceStartOffset: segment.sourceStartOffset,
          sourceKind: segment.sourceKind,
          className:
            result.displayMode === 'direct'
              ? 'document-translation-direct'
              : 'document-translation-bilingual',
          dataAttributes: {
            'data-translation-segment-id': segment.id,
            'data-translation-source': segment.source,
            'data-translation-target': segment.target ?? '',
            'data-translation-mode': result.displayMode,
            'data-translation-status': segment.status ?? 'translated',
            ...(segment.sourceLanguage
              ? { 'data-translation-source-lang': segment.sourceLanguage }
              : {}),
            ...(segment.targetLanguage
              ? { 'data-translation-target-lang': segment.targetLanguage }
              : {}),
          },
          renderChildren: (children) =>
            renderTranslationSegmentChildren({
              sourceChildren: children,
              segment,
              displayMode: result.displayMode,
            }),
        })
      ),
  }
}

function createTranslatedHeadingTransform(
  input: MarkdownHeadingTransformInput,
  segment: TranslationSegmentResult,
  displayMode: DocumentTranslationConfig['displayMode']
): MarkdownHeadingTransformResult {
  const projectedTarget = segment.target ?? ''
  const openSpecHeading = createTranslatedOpenSpecHeadingChildren(input, segment, displayMode)

  if (openSpecHeading) {
    return {
      tocDataLabel:
        displayMode === 'direct'
          ? openSpecHeading.tocDataLabel
          : (input.current?.tocLabel ?? input.text),
      children: openSpecHeading.children,
      dataAttributes: createTranslationDataAttributes(segment, projectedTarget, displayMode),
    }
  }

  const sourceChildren = input.current?.children ?? input.text

  if (displayMode === 'direct') {
    return {
      tocDataLabel: projectedTarget,
      children: renderTranslationSegmentChildren({
        sourceChildren,
        segment,
        displayMode,
        className: 'document-translation-heading-segment',
      }),
      dataAttributes: createTranslationDataAttributes(segment, projectedTarget, displayMode),
    }
  }

  return {
    tocDataLabel: input.text,
    children: renderTranslationSegmentChildren({
      sourceChildren,
      segment,
      displayMode,
      className: 'document-translation-heading-segment',
    }),
    dataAttributes: createTranslationDataAttributes(segment, projectedTarget, displayMode),
  }
}

function createTranslationDataAttributes(
  segment: TranslationSegmentResult,
  target: string,
  displayMode: DocumentTranslationConfig['displayMode']
) {
  return {
    'data-translation-segment-id': segment.id,
    'data-translation-source': segment.source,
    'data-translation-target': target,
    'data-translation-mode': displayMode,
    'data-translation-status': segment.status ?? 'translated',
    ...(segment.sourceLanguage ? { 'data-translation-source-lang': segment.sourceLanguage } : {}),
    ...(segment.targetLanguage ? { 'data-translation-target-lang': segment.targetLanguage } : {}),
  }
}

function createTranslatedOpenSpecHeadingChildren(
  input: MarkdownHeadingTransformInput,
  segment: TranslationSegmentResult,
  displayMode: DocumentTranslationConfig['displayMode']
): { children: ReactNode; tocDataLabel: string } | undefined {
  const kind = input.current?.dataAttributes?.['data-openspec-kind']
  if (kind !== 'requirement' && kind !== 'scenario') return undefined

  const sourceParts = splitOpenSpecHeadingText(segment.source)
  const targetParts = splitOpenSpecHeadingText(segment.target ?? '')
  const visualLabel =
    input.current?.dataAttributes?.['data-openspec-visual-label'] ??
    input.current?.dataAttributes?.['data-openspec-label']
  const sourceKind = sourceParts.kind || (kind === 'requirement' ? 'Requirement:' : 'Scenario:')
  const targetKind = targetParts.kind || sourceKind
  const sourceTitle = sourceParts.title || input.current?.dataAttributes?.['data-openspec-title']
  const targetTitle = targetParts.title || segment.target || ''
  const titleSegment = {
    ...segment,
    source: String(sourceTitle || segment.source),
    target: targetTitle,
  }

  return {
    tocDataLabel: targetTitle,
    children: (
      <>
        <span
          className="openspec-heading-label"
          data-openspec-heading-label=""
          {...(visualLabel ? { 'data-openspec-visual-label': visualLabel } : {})}
          data-translation-segment="heading-kind"
        >
          {displayMode === 'bilingual' ? (
            <>
              <span className="sr-only" lang={segment.sourceLanguage} data-translation-source="">
                {sourceKind}{' '}
              </span>
              <span className="sr-only" lang={segment.targetLanguage} data-translation-target="">
                {targetKind}{' '}
              </span>
            </>
          ) : (
            <span className="sr-only" lang={segment.targetLanguage} data-translation-target="">
              {targetKind}{' '}
            </span>
          )}
        </span>
        <span className="openspec-heading-title" data-openspec-heading-title="">
          {renderTranslationSegmentChildren({
            sourceChildren: String(sourceTitle || ''),
            segment: titleSegment,
            displayMode,
            className: 'document-translation-heading-segment',
          })}
        </span>
      </>
    ),
  }
}

function splitOpenSpecHeadingText(text: string): { kind?: string; title: string } {
  const match = /^([^:：]{1,32}[:：])\s*(.*)$/.exec(text.trim())
  if (!match) return { title: text.trim() }
  return {
    kind: match[1],
    title: match[2]?.trim() ?? '',
  }
}

function renderTranslationSegmentChildren({
  sourceChildren,
  segment,
  displayMode,
  className,
}: {
  sourceChildren: ReactNode
  segment: TranslationSegmentResult
  displayMode: DocumentTranslationConfig['displayMode']
  className?: string
}) {
  const target = segment.target ?? ''
  return (
    <span className={mergeClassName('document-translation-segment', className)}>
      {displayMode === 'bilingual' ? (
        <span
          className="document-translation-source"
          lang={segment.sourceLanguage}
          data-translation-source=""
        >
          {sourceChildren}
        </span>
      ) : null}
      <span
        className="document-translation-target"
        title={displayMode === 'direct' ? segment.source : undefined}
        lang={segment.targetLanguage}
        data-translation-target=""
      >
        <MarkdownInlineContent markdown={target} />
      </span>
    </span>
  )
}

function mergeClassName(...classNames: Array<string | undefined>): string | undefined {
  const merged = classNames.filter(Boolean).join(' ')
  return merged || undefined
}

function DocumentTranslationButton({
  enabled,
  status,
  onActivate,
}: {
  enabled: boolean
  status: ReturnType<typeof useDocumentTranslation>['status']
  onActivate: () => void
}) {
  const isTranslated = status === 'translated'
  const isBusy = status === 'initializing' || status === 'translating'
  const title = !enabled
    ? 'Configure translation'
    : isBusy
      ? 'Cancel translation'
      : isTranslated
        ? 'Show source'
        : 'Translate'

  return (
    <Button
      size="icon-sm"
      variant="secondary"
      onClick={(event) => {
        event.stopPropagation()
        onActivate()
      }}
      title={title}
      aria-label={title}
      className={
        isTranslated
          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border-primary text-primary hover:bg-primary/10'
      }
    >
      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
    </Button>
  )
}
