import { CountBadge } from './badge'
import {
  MarkdownViewer,
  type MarkdownHeadingTransform,
  type MarkdownHeadingTransformResult,
} from './markdown-viewer'
import { slugify } from './toc-context'

interface SpecMarkdownDocumentProps {
  markdown: string
  requirementCount?: number
  className?: string
}

interface OpenSpecHeading {
  kind: 'spec' | 'section' | 'requirement' | 'scenario'
  id: string
  title: string
  tocLabel: string
}

const OPENSPEC_PREFIXES = {
  requirement: /^Requirement:\s*/i,
  scenario: /^Scenario:\s*/i,
}

function stripPrefix(text: string, prefix: RegExp): string {
  return text.replace(prefix, '').trim()
}

export function describeOpenSpecHeading(
  sourceLevel: number,
  text: string
): OpenSpecHeading | undefined {
  if (sourceLevel === 1) {
    return {
      kind: 'spec',
      id: slugify(text) || 'spec',
      title: text,
      tocLabel: text,
    }
  }

  if (sourceLevel === 2) {
    return {
      kind: 'section',
      id: slugify(text) || 'section',
      title: text,
      tocLabel: text,
    }
  }

  if (sourceLevel === 3 && OPENSPEC_PREFIXES.requirement.test(text)) {
    const title = stripPrefix(text, OPENSPEC_PREFIXES.requirement)
    return {
      kind: 'requirement',
      id: `requirement-${slugify(title) || 'item'}`,
      title,
      tocLabel: title,
    }
  }

  if (sourceLevel === 4 && OPENSPEC_PREFIXES.scenario.test(text)) {
    const title = stripPrefix(text, OPENSPEC_PREFIXES.scenario)
    return {
      kind: 'scenario',
      id: `scenario-${slugify(title) || 'item'}`,
      title,
      tocLabel: title,
    }
  }

  return undefined
}

function createHeadingTransform(requirementCount?: number): MarkdownHeadingTransform {
  return ({ sourceLevel, text }): MarkdownHeadingTransformResult | undefined => {
    const heading = describeOpenSpecHeading(sourceLevel, text)
    if (!heading) return undefined

    return {
      id: heading.id,
      tocLabel: heading.tocLabel,
      className: createHeadingClassName(heading, requirementCount),
      suffix: createHeadingSuffix(heading, requirementCount),
      dataAttributes: {
        'data-openspec-kind': heading.kind,
        'data-openspec-title': heading.title,
      },
    }
  }
}

function createHeadingClassName(heading: OpenSpecHeading, requirementCount?: number) {
  if (heading.kind !== 'section' || heading.title !== 'Requirements') return undefined
  if (requirementCount === undefined) return undefined
  return 'openspec-heading-with-chip'
}

function createHeadingSuffix(heading: OpenSpecHeading, requirementCount?: number) {
  if (heading.kind !== 'section' || heading.title !== 'Requirements') return undefined
  if (requirementCount === undefined) return undefined

  return (
    <CountBadge
      count={requirementCount}
      tone="subtle"
      size="sm"
      shape="box"
      className="openspec-heading-chip"
      aria-label={String(requirementCount)}
      title={`${requirementCount} requirements`}
    />
  )
}

/**
 * Renders the processed spec Markdown as the visual source while attaching
 * OpenSpec structure metadata for styling, anchors, and ToC alignment.
 */
export function SpecMarkdownDocument({
  markdown,
  requirementCount,
  className = '',
}: SpecMarkdownDocumentProps) {
  return (
    <MarkdownViewer
      className={`spec-markdown-document ${className}`}
      markdown={markdown}
      headingTransform={createHeadingTransform(requirementCount)}
    />
  )
}
