import { Button } from '@/components/button'
import { useDocumentTranslation } from '@/lib/use-document-translation'
import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import { useNavigate } from '@tanstack/react-router'
import type { Element, Properties, RootContent, Text } from 'hast'
import { Languages, Loader2 } from 'lucide-react'
import { Fragment, useMemo, type ReactNode } from 'react'
import { visit } from 'unist-util-visit'
import { CodeBlock, MarkdownInlineContent, type MarkdownBlockAnnotation } from './markdown-content'
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
  const targetChildren = segment.targetNodes ? renderHastNodes(segment.targetNodes) : undefined

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
            targetChildren: segment.targetNodes ? renderHastNodes(segment.targetNodes) : undefined,
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
  targetChildren,
  className,
}: {
  sourceChildren: ReactNode
  segment: TranslationSegmentResult
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
            renderHastNodes(segment.targetNodes)
          ) : (
            <MarkdownInlineContent markdown={target} />
          ))}
      </span>
    </span>
  )
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

function renderHastNodes(nodes: readonly RootContent[]): ReactNode {
  return nodes.map((node, index) => (
    <Fragment key={`translated-hast-${index}`}>{renderHastNode(node)}</Fragment>
  ))
}

function renderHastNode(node: RootContent): ReactNode {
  if (node.type === 'text') return (node as Text).value
  if (node.type !== 'element') return null

  const element = node as Element
  const children = element.children.map((child, index) => (
    <Fragment key={`translated-hast-child-${index}`}>{renderHastNode(child)}</Fragment>
  ))
  const props = toReactElementProps(element.properties)

  switch (element.tagName) {
    case 'strong':
      return <strong {...props}>{children}</strong>
    case 'em':
      return <em {...props}>{children}</em>
    case 'del':
      return <del {...props}>{children}</del>
    case 'sub':
      return <sub {...props}>{children}</sub>
    case 'sup':
      return <sup {...props}>{children}</sup>
    case 'mark':
      return <mark {...props}>{children}</mark>
    case 'code':
      return (
        <CodeBlock className={typeof props.className === 'string' ? props.className : undefined}>
          {children}
        </CodeBlock>
      )
    case 'kbd':
      return <kbd {...props}>{children}</kbd>
    case 'samp':
      return <samp {...props}>{children}</samp>
    case 'var':
      return <var {...props}>{children}</var>
    case 'a':
      return <a {...props}>{children}</a>
    case 'span':
      return <span {...props}>{children}</span>
    case 'img':
      return <img {...props} />
    default:
      return <span>{children}</span>
  }
}

function toReactElementProps(properties: Properties): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) continue
    if (key === 'className' || key === 'class') {
      props.className = Array.isArray(value) ? value.join(' ') : String(value)
      continue
    }
    if ((key === 'href' || key === 'src') && typeof value === 'string') {
      const safeUrl = transformSafeMarkdownUrl(value)
      if (safeUrl) props[key] = safeUrl
      continue
    }
    props[key === 'aria-label' ? 'aria-label' : key] = value
  }
  return props
}

const SAFE_URL_PROTOCOL_PATTERN = /^(https?|ircs?|mailto|xmpp)$/i

function transformSafeMarkdownUrl(value: string): string {
  const colon = value.indexOf(':')
  const questionMark = value.indexOf('?')
  const numberSign = value.indexOf('#')
  const slash = value.indexOf('/')

  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (numberSign !== -1 && colon > numberSign) ||
    SAFE_URL_PROTOCOL_PATTERN.test(value.slice(0, colon))
  ) {
    return value
  }

  return ''
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
