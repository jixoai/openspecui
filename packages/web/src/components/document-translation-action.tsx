import { Button } from '@/components/button'
import { useDocumentTranslationActivation } from '@/lib/document-translation-session-state'
import { useDocumentTranslation } from '@/lib/use-document-translation'
import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { useNavigate } from '@tanstack/react-router'
import type { Element, Properties, RootContent } from 'hast'
import { Languages, Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { visit } from 'unist-util-visit'
import {
  renderTranslatedHastNodes,
  transformSafeMarkdownUrl,
} from './document-translation-hast-render'
import { createTranslatedOpenSpecHeadingProjection } from './document-translation-openspec-projection'
import {
  renderTranslationSegmentChildren,
  type DocumentTranslationSegmentResult,
} from './document-translation-segment-render'
import { type MarkdownBlockAnnotation } from './markdown-content'
import {
  type MarkdownHeadingTransformInput,
  type MarkdownHeadingTransformResult,
  type MarkdownRenderPluginResult,
  type MarkdownRenderProcessor,
} from './markdown-viewer'

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
    tocHeaderActionSlot: canTranslate ? 'document-translation' : undefined,
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
  const { setActivation } = useDocumentTranslationActivation()

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
          setActivation('source')
          session.cancel()
          return
        }
        if (session.status === 'translated') {
          setActivation('source')
          session.reset()
          return
        }
        setActivation('translated')
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
      processHast(tree) {
        if (result.displayMode !== 'direct') return
        visit(tree, 'element', (node) => {
          if (!isTranslationBlockOwner(node)) return
          const sourceStartOffset = node.position?.start.offset
          if (sourceStartOffset === undefined) return
          const segment = segmentByOffset.get(sourceStartOffset)
          if (!segment?.targetNodes || segment.kind === 'heading') return
          node.children = mergeTranslatedInlineChildren(node, segment.targetNodes)
        })
      },
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
            segment.targetNodes && result.displayMode === 'direct'
              ? children
              : renderTranslationSegmentChildren({
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
  segment: DocumentTranslationSegmentResult,
  displayMode: DocumentTranslationConfig['displayMode']
): MarkdownHeadingTransformResult {
  const projectedTarget = segment.target ?? ''
  const openSpecHeading = createTranslatedOpenSpecHeadingProjection(input, segment, displayMode)

  if (openSpecHeading) {
    return {
      tocDataLabel:
        displayMode === 'direct'
          ? openSpecHeading.tocDataLabel
          : (input.current?.tocLabel ?? input.text),
      children: openSpecHeading.children,
      dataAttributes: createTranslationDataAttributes(segment, openSpecHeading.target, displayMode),
    }
  }

  const sourceChildren = input.current?.children ?? input.text
  const targetChildren = segment.targetNodes
    ? renderTranslatedHastNodes(segment.targetNodes)
    : undefined

  if (displayMode === 'direct') {
    return {
      tocDataLabel: projectedTarget,
      children: renderTranslationSegmentChildren({
        sourceChildren,
        segment,
        displayMode,
        targetChildren,
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
      targetChildren,
      className: 'document-translation-heading-segment',
    }),
    dataAttributes: createTranslationDataAttributes(segment, projectedTarget, displayMode),
  }
}

function createTranslationDataAttributes(
  segment: DocumentTranslationSegmentResult,
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

function isTranslationBlockOwner(node: Element): boolean {
  return (
    node.tagName === 'p' ||
    node.tagName === 'li' ||
    node.tagName === 'blockquote' ||
    node.tagName === 'td' ||
    node.tagName === 'th'
  )
}

function mergeTranslatedInlineChildren(
  node: Element,
  targetNodes: readonly RootContent[]
): Element['children'] {
  const translatedChildren = sanitizeTranslatedElementChildren(targetNodes.filter(isElementContent))
  const preservedBlockChildren = node.children.filter(
    (child) => isElementContent(child) && isBlockElement(child)
  )
  return [...translatedChildren, ...preservedBlockChildren]
}

function isElementContent(node: RootContent): node is Element['children'][number] {
  return node.type === 'text' || node.type === 'element' || node.type === 'comment'
}

function isBlockElement(node: Element['children'][number]): boolean {
  if (node.type !== 'element') return false
  return (
    /^h[1-6]$/.test(node.tagName) ||
    node.tagName === 'p' ||
    node.tagName === 'ul' ||
    node.tagName === 'ol' ||
    node.tagName === 'li' ||
    node.tagName === 'blockquote' ||
    node.tagName === 'table' ||
    node.tagName === 'thead' ||
    node.tagName === 'tbody' ||
    node.tagName === 'tr' ||
    node.tagName === 'td' ||
    node.tagName === 'th' ||
    node.tagName === 'pre'
  )
}

function sanitizeTranslatedElementChildren(
  nodes: readonly Element['children'][number][]
): Element['children'] {
  return nodes.map(sanitizeTranslatedElementChild)
}

function sanitizeTranslatedElementChild(
  node: Element['children'][number]
): Element['children'][number] {
  if (node.type !== 'element') return node
  return {
    ...node,
    properties: sanitizeTranslatedProperties(node.properties),
    children: sanitizeTranslatedElementChildren(node.children),
  }
}

function sanitizeTranslatedProperties(properties: Properties): Properties {
  const nextProperties: Properties = { ...properties }
  for (const key of ['href', 'src'] as const) {
    const value = nextProperties[key]
    if (typeof value !== 'string' || !transformSafeMarkdownUrl(value)) {
      delete nextProperties[key]
    }
  }
  return nextProperties
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
