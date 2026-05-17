import type { MarkdownFact } from '@openspecui/core/markdown-facts'
import { getMarkdownFactSpan } from '@openspecui/core/markdown-reading'
import {
  OPEN_SPEC_READING_SECTIONS_PROJECTION_ID,
  getOpenSpecProjectionAnnotation,
  projectOpenSpecMarkdown,
  type ProjectedOpenSpecDocument,
} from '@openspecui/core/openspec-projection'
import { useMemo } from 'react'
import { CountBadge } from './badge'
import type { MarkdownBlockAnnotation, MarkdownInlineTextAnnotation } from './markdown-content'
import {
  type MarkdownHeadingTransform,
  type MarkdownHeadingTransformResult,
  type MarkdownRenderPluginContext,
  type MarkdownRenderPluginResult,
} from './markdown-viewer'
import { slugify } from './toc-context'

interface OpenSpecHeading {
  kind: 'spec' | 'section' | 'requirement' | 'scenario'
  id: string
  title: string
  tocLabel: string
  visiblePrefix?: string
  label?: string
  sectionKind?: string
}

const OPENSPEC_PREFIXES = {
  requirement: /^(?:Requirement|Capability):\s*/i,
  scenario: /^(?:Scenario|Example):\s*/i,
}

const OPENSPEC_INLINE_KEYWORD_CLASS = 'openspec-inline-keyword'
const OPENSPEC_SCENARIO_STEP_CLASS = 'spec-scenario-step'
const OPENSPEC_BLOCK_FACT_KINDS = new Set(['paragraph', 'list', 'listItem', 'blockquote', 'table'])
const OPENSPEC_SPEC_PATH_PATTERN = /(?:^|\/)specs\/([^/]+)\/spec\.md$/

type OpenSpecKeywordRole = 'scenario-step' | 'requirement-modal'

export function getOpenSpecSpecIdFromMarkdownPath(path: string | undefined): string | undefined {
  if (!path) return undefined
  return normalizeMarkdownPath(path).match(OPENSPEC_SPEC_PATH_PATTERN)?.[1]
}

export function useOpenSpecMarkdownRenderPlugin({
  markdown,
  path,
  spec,
  requirementCount,
}: MarkdownRenderPluginContext): MarkdownRenderPluginResult {
  const sourceMarkdown = typeof markdown === 'string' ? markdown : undefined
  const pathSpecId = useMemo(() => getOpenSpecSpecIdFromMarkdownPath(path), [path])
  const document = useMemo(
    () =>
      sourceMarkdown && pathSpecId
        ? projectOpenSpecMarkdown(sourceMarkdown, { specId: spec?.id ?? pathSpecId })
        : undefined,
    [pathSpecId, sourceMarkdown, spec?.id]
  )

  const resolvedRequirementCount =
    requirementCount ??
    spec?.requirements.length ??
    document?.projections[OPEN_SPEC_READING_SECTIONS_PROJECTION_ID]?.requirements.length

  const headingTransform = useMemo(
    () =>
      document ? createAnnotatedHeadingTransform(document, resolvedRequirementCount) : undefined,
    [document, resolvedRequirementCount]
  )
  const inlineTextAnnotations = useMemo(
    () => (document ? createOpenSpecInlineTextAnnotations(document) : []),
    [document]
  )
  const blockAnnotations = useMemo(
    () => (document ? createOpenSpecBlockAnnotations(document) : []),
    [document]
  )

  if (!pathSpecId || !document || !headingTransform) return {}

  return {
    className: 'openspec-markdown-document spec-reading-document',
    processors: [
      {
        name: 'openspec-spec-document',
        order: 100,
        transformHeading: headingTransform,
      },
    ],
    inlineTextAnnotations,
    blockAnnotations,
  }
}

function normalizeMarkdownPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^openspec\//, '')
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
    const visiblePrefix = text.match(OPENSPEC_PREFIXES.requirement)?.[0].trim()
    const title = stripPrefix(text, OPENSPEC_PREFIXES.requirement)
    return {
      kind: 'requirement',
      id: `requirement-${slugify(title) || 'item'}`,
      title,
      tocLabel: title,
      ...(visiblePrefix ? { visiblePrefix } : {}),
    }
  }

  if (sourceLevel === 4 && OPENSPEC_PREFIXES.scenario.test(text)) {
    const visiblePrefix = text.match(OPENSPEC_PREFIXES.scenario)?.[0].trim()
    const title = stripPrefix(text, OPENSPEC_PREFIXES.scenario)
    return {
      kind: 'scenario',
      id: `scenario-${slugify(title) || 'item'}`,
      title,
      tocLabel: title,
      ...(visiblePrefix ? { visiblePrefix } : {}),
    }
  }

  return undefined
}

function describeAnnotatedOpenSpecHeading(
  document: ProjectedOpenSpecDocument,
  headingFact: MarkdownFact | undefined,
  sourceLevel: number,
  text: string
): OpenSpecHeading | undefined {
  if (!headingFact) return describeOpenSpecHeading(sourceLevel, text)
  const readingProjection = document.projections[OPEN_SPEC_READING_SECTIONS_PROJECTION_ID]

  if (sourceLevel === 2) {
    const section = readingProjection?.sections.find((section) => section.factId === headingFact.id)
    return {
      kind: 'section',
      id: slugify(text) || 'section',
      title: text,
      tocLabel: text,
      ...(section ? { sectionKind: section.kind } : {}),
    }
  }

  const requirement = getOpenSpecProjectionAnnotation(
    document.annotations,
    headingFact.id,
    'requirement'
  )
  if (requirement) {
    const title = requirement.metadata?.title?.trim() || text
    const requirementIndex =
      readingProjection?.requirements.findIndex((block) => block.factId === headingFact.id) ?? -1
    return {
      kind: 'requirement',
      id: `requirement-${slugify(title) || 'item'}`,
      title,
      tocLabel: title,
      visiblePrefix: text.match(OPENSPEC_PREFIXES.requirement)?.[0].trim() ?? 'Requirement:',
      label: requirementIndex >= 0 ? formatRequirementLabel(requirementIndex + 1) : 'Requirement',
    }
  }

  const scenario = getOpenSpecProjectionAnnotation(document.annotations, headingFact.id, 'scenario')
  if (scenario) {
    const title = scenario.metadata?.title?.trim() || text
    return {
      kind: 'scenario',
      id: `scenario-${slugify(title) || 'item'}`,
      title,
      tocLabel: title,
      visiblePrefix: text.match(OPENSPEC_PREFIXES.scenario)?.[0].trim() ?? 'Scenario:',
      label: 'Scenario',
    }
  }

  return describeOpenSpecHeading(sourceLevel, text)
}

function createAnnotatedHeadingTransform(
  document: ProjectedOpenSpecDocument,
  requirementCount?: number
): MarkdownHeadingTransform {
  const headingByStartOffset = new Map<number, MarkdownFact>()
  for (const fact of document.facts) {
    if (fact.kind !== 'heading' || typeof fact.depth !== 'number') continue
    const span = getMarkdownFactSpan(fact)
    if (span) {
      headingByStartOffset.set(span.start, fact)
    }
  }

  return ({ sourceLevel, text, sourceStartOffset }): MarkdownHeadingTransformResult | undefined => {
    const headingFact =
      sourceStartOffset === undefined ? undefined : headingByStartOffset.get(sourceStartOffset)
    const heading = describeAnnotatedOpenSpecHeading(document, headingFact, sourceLevel, text)
    if (!heading) return undefined

    return {
      id: heading.id,
      tocLabel: heading.tocLabel,
      children: createHeadingChildren(heading, text),
      className: createHeadingClassName(heading, requirementCount),
      suffix: createHeadingSuffix(heading, requirementCount),
      dataAttributes: {
        'data-openspec-kind': heading.kind,
        'data-openspec-title': heading.title,
        ...(heading.label ? { 'data-openspec-label': heading.label } : {}),
        ...(heading.label ? { 'data-openspec-visual-label': heading.label } : {}),
        ...(heading.sectionKind ? { 'data-openspec-section-kind': heading.sectionKind } : {}),
      },
    }
  }
}

function createHeadingChildren(heading: OpenSpecHeading, fallbackText: string) {
  if (heading.kind !== 'requirement' && heading.kind !== 'scenario') return undefined

  const label =
    heading.visiblePrefix ?? (heading.kind === 'requirement' ? 'Requirement:' : 'Scenario:')
  const title = heading.title || stripPrefix(fallbackText, OPENSPEC_PREFIXES[heading.kind])

  return (
    <>
      <span
        className="openspec-heading-label"
        data-openspec-heading-label=""
        {...(heading.label ? { 'data-openspec-visual-label': heading.label } : {})}
        data-translation-segment="heading-kind"
      >
        <span className="sr-only">{label} </span>
      </span>
      <span className="openspec-heading-title" data-openspec-heading-title="">
        {title}
      </span>
    </>
  )
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

function createOpenSpecBlockAnnotations(
  document: ProjectedOpenSpecDocument
): readonly MarkdownBlockAnnotation[] {
  const factById = new Map(document.facts.map((fact) => [fact.id, fact]))
  const annotationByOffset = new Map<string, MarkdownBlockAnnotation>()
  const readingProjection = document.projections[OPEN_SPEC_READING_SECTIONS_PROJECTION_ID]

  if (readingProjection) {
    for (const section of readingProjection.sections) {
      if (section.kind !== 'overview') continue
      addRangeBlockAnnotations(document, annotationByOffset, {
        start: getFactEnd(factById, section.factId, section.start),
        end: section.end,
        dataAttributes: {
          'data-openspec-zone': 'purpose',
          'data-openspec-section-kind': section.kind,
          'data-openspec-section-title': section.title,
        },
      })
    }

    const requirementsSection = readingProjection.sections.find(
      (section) => section.kind === 'requirements'
    )
    if (requirementsSection) {
      const firstRequirementStart = readingProjection.requirements
        .map((requirement) => requirement.start)
        .sort((left, right) => left - right)[0]
      addRangeBlockAnnotations(document, annotationByOffset, {
        start: getFactEnd(factById, requirementsSection.factId, requirementsSection.start),
        end: firstRequirementStart ?? requirementsSection.end,
        dataAttributes: {
          'data-openspec-zone': 'requirements-intro',
          'data-openspec-section-kind': requirementsSection.kind,
          'data-openspec-section-title': requirementsSection.title,
        },
      })
    }

    for (const [index, requirement] of readingProjection.requirements.entries()) {
      const requirementLabel = formatRequirementLabel(index + 1)
      const firstScenarioStart = requirement.scenarios
        .map((scenario) => scenario.start)
        .sort((left, right) => left - right)[0]
      const requirementData = {
        'data-openspec-requirement-id': requirement.id,
        'data-openspec-requirement-label': requirementLabel,
        'data-openspec-requirement-title': requirement.title,
      }

      addRangeBlockAnnotations(document, annotationByOffset, {
        start: getFactEnd(factById, requirement.factId, requirement.start),
        end: firstScenarioStart ?? requirement.end,
        dataAttributes: {
          'data-openspec-zone': 'requirement-body',
          ...requirementData,
        },
      })

      for (const scenario of requirement.scenarios) {
        addRangeBlockAnnotations(document, annotationByOffset, {
          start: getFactEnd(factById, scenario.factId, scenario.start),
          end: scenario.end,
          dataAttributes: {
            'data-openspec-zone': 'scenario-body',
            ...requirementData,
            'data-openspec-scenario-title': scenario.title,
          },
        })
      }
    }
  }

  for (const annotation of document.annotations) {
    if (annotation.kind !== 'scenario-step') continue

    const fact = factById.get(annotation.targetFactId)
    const span = fact ? getMarkdownFactSpan(fact) : undefined
    if (!fact || !span) continue

    const keyword = annotation.metadata?.keyword
    upsertBlockAnnotation(annotationByOffset, {
      sourceStartOffset: span.start,
      sourceKind: fact.mdastType,
      className: OPENSPEC_SCENARIO_STEP_CLASS,
      dataAttributes: {
        'data-openspec-kind': 'scenario-step',
        ...(keyword ? { 'data-openspec-step-keyword': keyword } : {}),
      },
    })
  }

  return Array.from(annotationByOffset.values())
}

function addRangeBlockAnnotations(
  document: ProjectedOpenSpecDocument,
  annotationByOffset: Map<string, MarkdownBlockAnnotation>,
  range: {
    start: number
    end: number
    dataAttributes: NonNullable<MarkdownBlockAnnotation['dataAttributes']>
  }
) {
  for (const fact of document.facts) {
    if (!OPENSPEC_BLOCK_FACT_KINDS.has(fact.kind)) continue
    const span = getMarkdownFactSpan(fact)
    if (!span || span.start < range.start || span.start >= range.end) continue

    upsertBlockAnnotation(annotationByOffset, {
      sourceStartOffset: span.start,
      sourceKind: fact.mdastType,
      dataAttributes: {
        'data-openspec-block-kind': fact.kind,
        ...range.dataAttributes,
      },
    })
  }
}

function upsertBlockAnnotation(
  annotationByOffset: Map<string, MarkdownBlockAnnotation>,
  annotation: MarkdownBlockAnnotation
) {
  const key = createBlockAnnotationKey(annotation)
  const previous = annotationByOffset.get(key)
  if (!previous) {
    annotationByOffset.set(key, annotation)
    return
  }

  annotationByOffset.set(key, {
    sourceStartOffset: annotation.sourceStartOffset,
    sourceKind: annotation.sourceKind,
    className: [previous.className, annotation.className].filter(Boolean).join(' ') || undefined,
    dataAttributes: {
      ...previous.dataAttributes,
      ...annotation.dataAttributes,
    },
  })
}

function createBlockAnnotationKey(annotation: MarkdownBlockAnnotation): string {
  return `${annotation.sourceStartOffset}:${annotation.sourceKind ?? '*'}`
}

function getFactEnd(factById: ReadonlyMap<string, MarkdownFact>, factId: string, fallback: number) {
  const fact = factById.get(factId)
  return fact ? (getMarkdownFactSpan(fact)?.end ?? fallback) : fallback
}

function formatRequirementLabel(index: number) {
  return `REQ-${String(index).padStart(2, '0')}`
}

function createOpenSpecInlineTextAnnotations(
  document: ProjectedOpenSpecDocument
): readonly MarkdownInlineTextAnnotation[] {
  const terms = new Map<string, MarkdownInlineTextAnnotation>()

  for (const annotation of document.annotations) {
    if (annotation.kind !== 'keyword') continue
    const { keyword, keywordText, keywordRole } = annotation.metadata ?? {}
    const text = keywordText ?? keyword
    if (!keyword || !text) continue

    terms.set(text, {
      text,
      className: OPENSPEC_INLINE_KEYWORD_CLASS,
      dataAttributes: createOpenSpecKeywordDataAttributes(keyword, keywordRole),
    })
  }

  return Array.from(terms.values())
}

function createOpenSpecKeywordDataAttributes(keyword: string, keywordRole?: OpenSpecKeywordRole) {
  return {
    'data-openspec-keyword': keyword,
    ...(keywordRole ? { 'data-openspec-keyword-role': keywordRole } : {}),
  }
}
