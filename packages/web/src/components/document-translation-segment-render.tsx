import type { useDocumentTranslation } from '@/lib/use-document-translation'
import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import type { ReactNode } from 'react'
import { renderTranslatedHastNodes } from './document-translation-hast-render'
import { MarkdownInlineContent } from './markdown-content'

export type DocumentTranslationSegmentResult = NonNullable<
  ReturnType<typeof useDocumentTranslation>['result']
>['segments'][number]

export function renderTranslationSegmentChildren({
  sourceChildren,
  segment,
  displayMode,
  targetChildren,
  className,
}: {
  sourceChildren: ReactNode
  segment: DocumentTranslationSegmentResult
  displayMode: DocumentTranslationConfig['displayMode']
  targetChildren?: ReactNode
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
        {targetChildren ??
          (segment.targetNodes ? (
            renderTranslatedHastNodes(segment.targetNodes)
          ) : (
            <MarkdownInlineContent markdown={target} />
          ))}
      </span>
    </span>
  )
}

export function mergeClassName(...classNames: Array<string | undefined>): string | undefined {
  const merged = classNames.filter(Boolean).join(' ')
  return merged || undefined
}
