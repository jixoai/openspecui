import type { DocumentTranslationConfig } from '@openspecui/core/document-translation'
import type { Element, RootContent, Text } from 'hast'
import type { ReactNode } from 'react'
import { renderTranslatedHastNodes } from './document-translation-hast-render'
import {
  renderTranslationSegmentChildren,
  type DocumentTranslationSegmentResult,
} from './document-translation-segment-render'
import type { MarkdownHeadingTransformInput } from './markdown-viewer'

type OpenSpecStructureHeadingKind = 'requirement' | 'scenario'

const OPENSPEC_STRUCTURE_HEADING_LABELS: Record<
  OpenSpecStructureHeadingKind,
  { source: string; target: string; prefixPattern: RegExp }
> = {
  requirement: {
    source: 'Requirement:',
    target: '要求：',
    prefixPattern: /^\s*((?:Requirement|Capability|要求|需求|功能|能力)\s*[:：])\s*/i,
  },
  scenario: {
    source: 'Scenario:',
    target: '场景：',
    prefixPattern: /^\s*((?:Scenario|Example|场景|示例|例子)\s*[:：])\s*/i,
  },
}

const OPENSPEC_SECTION_TARGET_LABELS: Record<string, string> = {
  overview: '目的',
  requirements: '需求',
}

export function createTranslatedOpenSpecHeadingProjection(
  input: MarkdownHeadingTransformInput,
  segment: DocumentTranslationSegmentResult,
  displayMode: DocumentTranslationConfig['displayMode']
): { children: ReactNode; tocDataLabel: string; target: string } | undefined {
  const kind = getCurrentDataAttribute(input, 'data-openspec-kind')
  if (kind === 'section') {
    return createTranslatedOpenSpecSectionHeadingProjection(input, segment, displayMode)
  }
  if (kind !== 'requirement' && kind !== 'scenario') return undefined

  return createTranslatedOpenSpecStructureHeadingProjection(input, segment, displayMode, kind)
}

function createTranslatedOpenSpecSectionHeadingProjection(
  input: MarkdownHeadingTransformInput,
  segment: DocumentTranslationSegmentResult,
  displayMode: DocumentTranslationConfig['displayMode']
): { children: ReactNode; tocDataLabel: string; target: string } | undefined {
  const sectionKind = getCurrentDataAttribute(input, 'data-openspec-section-kind')
  if (!sectionKind) return undefined
  const targetTitle = OPENSPEC_SECTION_TARGET_LABELS[sectionKind]
  if (!targetTitle) return undefined

  const sourceTitle = getCurrentDataAttribute(input, 'data-openspec-title') || input.text
  const titleSegment = {
    ...segment,
    source: sourceTitle,
    target: targetTitle,
  }

  // OpenSpec structure words are semantic chrome owned by the projection layer.
  // Browser translation output may help content, but it must not invent section labels.
  return {
    target: targetTitle,
    tocDataLabel: targetTitle,
    children: renderTranslationSegmentChildren({
      sourceChildren: sourceTitle,
      segment: titleSegment,
      displayMode,
      targetChildren: targetTitle,
      className: 'document-translation-heading-segment',
    }),
  }
}

function createTranslatedOpenSpecStructureHeadingProjection(
  input: MarkdownHeadingTransformInput,
  segment: DocumentTranslationSegmentResult,
  displayMode: DocumentTranslationConfig['displayMode'],
  kind: OpenSpecStructureHeadingKind
): { children: ReactNode; tocDataLabel: string; target: string } {
  const sourceParts = splitOpenSpecHeadingText(segment.source, kind)
  const targetParts = splitOpenSpecHeadingText(segment.target ?? '', kind)
  const visualLabel =
    getCurrentDataAttribute(input, 'data-openspec-visual-label') ??
    getCurrentDataAttribute(input, 'data-openspec-label')
  const sourceKind = sourceParts.kind || OPENSPEC_STRUCTURE_HEADING_LABELS[kind].source
  const targetKind = targetParts.kind || OPENSPEC_STRUCTURE_HEADING_LABELS[kind].target
  const sourceTitle =
    sourceParts.title || getCurrentDataAttribute(input, 'data-openspec-title') || segment.source
  const targetTitle =
    targetParts.title ||
    stripOpenSpecHeadingKindPrefix(segment.target ?? '', kind) ||
    segment.target ||
    ''
  const targetNodes = segment.targetNodes
    ? stripOpenSpecHeadingKindFromTargetNodes(segment.targetNodes, kind)
    : undefined
  const titleSegment = {
    ...segment,
    source: sourceTitle,
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
            targetChildren: targetNodes ? renderTranslatedHastNodes(targetNodes) : undefined,
            className: 'document-translation-heading-segment',
          })}
        </span>
      </>
    ),
    target: targetTitle,
  }
}

function getCurrentDataAttribute(
  input: MarkdownHeadingTransformInput,
  key: `data-${string}`
): string | undefined {
  const value = input.current?.dataAttributes?.[key]
  return typeof value === 'string' ? value : undefined
}

function splitOpenSpecHeadingText(
  text: string,
  kind: OpenSpecStructureHeadingKind
): { kind?: string; title: string } {
  const trimmed = text.trim()
  const match = OPENSPEC_STRUCTURE_HEADING_LABELS[kind].prefixPattern.exec(trimmed)
  if (!match) return { title: text.trim() }
  return {
    kind: match[1]?.trim(),
    title: trimmed.slice(match[0].length).trim(),
  }
}

function stripOpenSpecHeadingKindPrefix(text: string, kind: OpenSpecStructureHeadingKind): string {
  return text.trim().replace(OPENSPEC_STRUCTURE_HEADING_LABELS[kind].prefixPattern, '').trim()
}

function stripOpenSpecHeadingKindFromTargetNodes(
  nodes: readonly RootContent[],
  kind: OpenSpecStructureHeadingKind
): RootContent[] | undefined {
  const state = { stripped: false }
  const strippedNodes = nodes
    .map((node) => stripOpenSpecHeadingKindFromRootNode(node, kind, state))
    .filter((node) => !(node.type === 'text' && node.value.length === 0))
  return state.stripped ? strippedNodes : undefined
}

function stripOpenSpecHeadingKindFromRootNode(
  node: RootContent,
  kind: OpenSpecStructureHeadingKind,
  state: { stripped: boolean }
): RootContent {
  if (node.type === 'text') {
    return stripOpenSpecHeadingKindFromTextNode(node, kind, state)
  }
  if (node.type !== 'element') return { ...node }

  return {
    ...node,
    properties: { ...node.properties },
    children: node.children.map((child) =>
      stripOpenSpecHeadingKindFromElementChild(child, kind, state)
    ),
  }
}

function stripOpenSpecHeadingKindFromElementChild(
  node: Element['children'][number],
  kind: OpenSpecStructureHeadingKind,
  state: { stripped: boolean }
): Element['children'][number] {
  if (node.type === 'text') {
    return stripOpenSpecHeadingKindFromTextNode(node, kind, state)
  }
  if (node.type !== 'element') return { ...node }

  return {
    ...node,
    properties: { ...node.properties },
    children: node.children.map((child) =>
      stripOpenSpecHeadingKindFromElementChild(child, kind, state)
    ),
  }
}

function stripOpenSpecHeadingKindFromTextNode<T extends Text>(
  node: T,
  kind: OpenSpecStructureHeadingKind,
  state: { stripped: boolean }
): T {
  if (state.stripped) return { ...node }

  const value = stripOpenSpecHeadingKindPrefix(node.value, kind)
  state.stripped = value !== node.value.trim()
  return { ...node, value }
}
