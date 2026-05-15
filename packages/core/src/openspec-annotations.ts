import {
  parseMarkdownFacts,
  type MarkdownFact,
  type MarkdownFactsDocument,
} from './markdown-facts.js'
import {
  createMarkdownReadingDocumentFromFacts,
  getMarkdownFactSpan,
  getMarkdownHeadingEnd,
  getMarkdownHeadingFacts,
  type MarkdownAnnotation,
  type MarkdownAnnotationConfidence,
  type MarkdownAnnotationContext,
  type MarkdownAnnotationInput,
  type MarkdownAnnotationRule,
  type MarkdownReadingDocument,
  type MarkdownReadingPlugin,
} from './markdown-reading.js'

export type OpenSpecSemanticKind =
  | 'document-title'
  | 'purpose-section'
  | 'requirements-section'
  | 'requirement'
  | 'scenario'
  | 'scenario-step'
  | 'keyword'

export type OpenSpecAnnotationConfidence = MarkdownAnnotationConfidence

export type OpenSpecScenarioStepKeyword = 'GIVEN' | 'WHEN' | 'THEN' | 'AND' | 'BUT'
export type OpenSpecRequirementKeyword = 'SHALL' | 'MUST' | 'SHOULD' | 'MAY'
export type OpenSpecKeyword = OpenSpecScenarioStepKeyword | OpenSpecRequirementKeyword
export type OpenSpecKeywordRole = 'scenario-step' | 'requirement-modal'

export interface OpenSpecAnnotationMetadata {
  title?: string
  keyword?: OpenSpecKeyword
  keywordText?: string
  keywordRole?: OpenSpecKeywordRole
  contentMarkdown?: string
  rawMarkdown?: string
}

export type OpenSpecAnnotation = MarkdownAnnotation<
  OpenSpecSemanticKind,
  OpenSpecAnnotationMetadata
>

export interface AnnotatedOpenSpecDocument extends MarkdownReadingDocument {
  annotations: OpenSpecAnnotation[]
}

type OpenSpecAnnotationInput = MarkdownAnnotationInput<
  OpenSpecSemanticKind,
  OpenSpecAnnotationMetadata
>

interface HeadingSection {
  fact: MarkdownFact
  start: number
  end: number
}

const OPEN_SPEC_ANNOTATION_RULES = {
  documentTitle: 'openspec.heading.document-title.v2',
  purposeSection: 'openspec.heading.purpose-section.v2',
  requirementsSection: 'openspec.heading.requirements-section.v2',
  requirementPrefix: 'openspec.heading.requirement-prefix.v2',
  requirementUnderSection: 'openspec.heading.requirement-under-section.v2',
  requirementCapabilityPrefix: 'openspec.heading.capability-prefix.v2',
  requirementCapabilityText: 'openspec.heading.capability-text.v2',
  scenarioPrefix: 'openspec.heading.scenario-prefix.v2',
  scenarioExamplePrefix: 'openspec.heading.example-prefix.v2',
  scenarioStepHeading: 'openspec.heading.step-backed-scenario.v2',
  scenarioStep: 'openspec.list-item.scenario-step.v2',
  keyword: 'openspec.inline.keyword.v2',
} as const

const REQUIREMENT_PREFIX_PATTERN = /^(?:Requirement|Capability):\s*/i
const SCENARIO_PREFIX_PATTERN = /^(?:Scenario|Example):\s*/i
const SCENARIO_STEP_KEYWORDS = ['GIVEN', 'WHEN', 'THEN', 'AND', 'BUT'] as const
const REQUIREMENT_KEYWORDS = ['SHALL', 'MUST', 'SHOULD', 'MAY'] as const
const REQUIREMENT_KEYWORD_PATTERN = new RegExp(`\\b(${REQUIREMENT_KEYWORDS.join('|')})\\b`, 'g')
const SCENARIO_STEP_PATTERN = new RegExp(
  `^\\s*(?:[-*+]\\s+)?(?:\\[[ xX]\\]\\s+)?(?:\\*\\*)?(${SCENARIO_STEP_KEYWORDS.join(
    '|'
  )})\\b(?:\\*\\*)?\\s*:?\\s*(.+?)\\s*$`,
  'i'
)
const REQUIREMENT_SECTION_TERMS = ['requirement', 'specification', 'capability', 'capabilities']
const PURPOSE_SECTION_TERMS = ['purpose', 'overview', 'objective', 'goal', 'goals']
const REQUIREMENT_BODY_SIGNAL_PATTERN = /\b(SHALL|MUST|SHOULD|MAY|CAN|WILL)\b/i
const NON_SCENARIO_HEADING_PATTERN =
  /^(notes?|details?|rationale|reason|migration|examples?|open questions?)$/i

export const openSpecAnnotationRules: readonly MarkdownAnnotationRule[] = [
  {
    id: OPEN_SPEC_ANNOTATION_RULES.documentTitle,
    annotate(context) {
      return context.facts.flatMap((fact): OpenSpecAnnotationInput[] => {
        if (fact.kind !== 'heading' || fact.depth !== 1) return []
        return [
          {
            kind: 'document-title',
            targetFactId: fact.id,
            confidence: 'strong',
            metadata: { title: fact.text },
          },
        ]
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.purposeSection,
    annotate(context) {
      return context.facts.flatMap((fact): OpenSpecAnnotationInput[] => {
        if (fact.kind !== 'heading' || fact.depth !== 2) return []
        if (!matchesAnyTerm(fact.text, PURPOSE_SECTION_TERMS)) return []
        return [
          {
            kind: 'purpose-section',
            targetFactId: fact.id,
            confidence: isExactTerm(fact.text, ['Purpose', 'Overview']) ? 'strong' : 'weak',
            metadata: { title: fact.text },
          },
        ]
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.requirementsSection,
    annotate(context) {
      return context.facts.flatMap((fact): OpenSpecAnnotationInput[] => {
        if (fact.kind !== 'heading' || fact.depth !== 2) return []
        if (!matchesAnyTerm(fact.text, REQUIREMENT_SECTION_TERMS)) return []
        return [
          {
            kind: 'requirements-section',
            targetFactId: fact.id,
            confidence: fact.text.toLowerCase().includes('requirement') ? 'strong' : 'weak',
            metadata: { title: fact.text },
          },
        ]
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.requirementPrefix,
    annotate(context) {
      return context.facts.flatMap((fact): OpenSpecAnnotationInput[] => {
        if (fact.kind !== 'heading' || fact.depth !== 3) return []
        if (!/^Requirement:\s*/i.test(fact.text)) return []
        return [createRequirementAnnotation(fact, 'strong')]
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.requirementCapabilityPrefix,
    annotate(context) {
      return context.facts.flatMap((fact): OpenSpecAnnotationInput[] => {
        if (fact.kind !== 'heading' || fact.depth !== 3) return []
        if (!/^Capability:\s*/i.test(fact.text)) return []
        return [createRequirementAnnotation(fact, 'weak')]
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.requirementUnderSection,
    annotate(context) {
      return getRequirementSections(context).flatMap((section): OpenSpecAnnotationInput[] => {
        return getChildHeadings(context, section, 3).flatMap((fact): OpenSpecAnnotationInput[] => {
          if (context.getAnnotation(fact.id, 'requirement')) return []
          if (REQUIREMENT_PREFIX_PATTERN.test(fact.text)) return []
          if (!hasRequirementBodySignals(context, fact, section.end)) return []
          return [
            {
              kind: 'requirement',
              targetFactId: fact.id,
              confidence: 'weak',
              metadata: { title: fact.text },
            },
          ]
        })
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.requirementCapabilityText,
    annotate(context) {
      return getRequirementSections(context).flatMap((section): OpenSpecAnnotationInput[] => {
        return getChildHeadings(context, section, 3).flatMap((fact): OpenSpecAnnotationInput[] => {
          if (context.getAnnotation(fact.id, 'requirement')) return []
          if (!matchesAnyTerm(fact.text, ['capability', 'feature', 'behavior'])) return []
          return [
            {
              kind: 'requirement',
              targetFactId: fact.id,
              confidence: 'weak',
              metadata: { title: stripRequirementPrefix(fact.text) || fact.text },
            },
          ]
        })
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.scenarioPrefix,
    annotate(context) {
      return getRequirementHeadings(context).flatMap((requirement): OpenSpecAnnotationInput[] => {
        return getNestedHeadings(context, requirement).flatMap(
          (fact): OpenSpecAnnotationInput[] => {
            if (fact.depth !== 4 || !/^Scenario:\s*/i.test(fact.text)) return []
            return [createScenarioAnnotation(fact, 'strong')]
          }
        )
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.scenarioExamplePrefix,
    annotate(context) {
      return getRequirementHeadings(context).flatMap((requirement): OpenSpecAnnotationInput[] => {
        return getNestedHeadings(context, requirement).flatMap(
          (fact): OpenSpecAnnotationInput[] => {
            if (fact.depth !== 4 || !/^Example:\s*/i.test(fact.text)) return []
            return [createScenarioAnnotation(fact, 'weak')]
          }
        )
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.scenarioStepHeading,
    annotate(context) {
      return getRequirementHeadings(context).flatMap((requirement): OpenSpecAnnotationInput[] => {
        return getNestedHeadings(context, requirement).flatMap(
          (fact): OpenSpecAnnotationInput[] => {
            if (fact.depth !== 4) return []
            if (context.getAnnotation(fact.id, 'scenario')) return []
            if (NON_SCENARIO_HEADING_PATTERN.test(fact.text)) return []
            if (!hasScenarioStepSignals(context, fact)) return []
            return [
              {
                kind: 'scenario',
                targetFactId: fact.id,
                confidence: 'weak',
                metadata: { title: stripScenarioPrefix(fact.text) || fact.text },
              },
            ]
          }
        )
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.scenarioStep,
    annotate(context) {
      const scenarioSections = getScenarioSections(context)
      return context.facts.flatMap((fact): OpenSpecAnnotationInput[] => {
        if (fact.kind !== 'listItem') return []
        if (!isWithinAnySection(fact, scenarioSections)) return []
        const metadata = parseScenarioStepFact(fact)
        if (!metadata) return []
        return [
          {
            kind: 'scenario-step',
            targetFactId: fact.id,
            confidence: 'strong',
            metadata,
          },
        ]
      })
    },
  },
  {
    id: OPEN_SPEC_ANNOTATION_RULES.keyword,
    annotate(context) {
      const scenarioKeywordAnnotations = context.previousAnnotations.flatMap(
        (annotation): OpenSpecAnnotationInput[] => {
          if (annotation.kind !== 'scenario-step') return []
          const fact = context.factById.get(annotation.targetFactId)
          if (!fact) return []
          return findScenarioStepKeyword(fact, readAnnotationKeyword(annotation.metadata))
        }
      )
      const requirementKeywordAnnotations = context.facts.flatMap(
        (fact): OpenSpecAnnotationInput[] => {
          if (!canAnnotateInlineKeywords(fact)) return []
          return findRequirementKeywords(fact)
        }
      )

      return [...scenarioKeywordAnnotations, ...requirementKeywordAnnotations]
    },
  },
]

export const builtinOpenSpecReadingPlugin: MarkdownReadingPlugin = {
  id: 'openspec.builtin-reading.v2',
  annotationRules: openSpecAnnotationRules,
}

export function annotateOpenSpecMarkdown(
  sourceMarkdown: string,
  plugins: readonly MarkdownReadingPlugin[] = [builtinOpenSpecReadingPlugin]
): AnnotatedOpenSpecDocument {
  return annotateOpenSpecFacts(parseMarkdownFacts(sourceMarkdown), plugins)
}

export function annotateOpenSpecFacts(
  document: MarkdownFactsDocument,
  plugins: readonly MarkdownReadingPlugin[] = [builtinOpenSpecReadingPlugin]
): AnnotatedOpenSpecDocument {
  const readingDocument = createMarkdownReadingDocumentFromFacts(document, plugins)
  return {
    ...readingDocument,
    annotations: readingDocument.annotations.filter(isOpenSpecAnnotation),
  }
}

export function getOpenSpecAnnotationsForFact(
  document: AnnotatedOpenSpecDocument,
  factId: string
): OpenSpecAnnotation[] {
  return document.annotations.filter((annotation) => annotation.targetFactId === factId)
}

export function getOpenSpecAnnotation(
  document: AnnotatedOpenSpecDocument,
  factId: string,
  kind: OpenSpecSemanticKind
): OpenSpecAnnotation | undefined {
  return document.annotations.find(
    (annotation) => annotation.targetFactId === factId && annotation.kind === kind
  )
}

function isOpenSpecAnnotation(annotation: MarkdownAnnotation): annotation is OpenSpecAnnotation {
  return (
    annotation.kind === 'document-title' ||
    annotation.kind === 'purpose-section' ||
    annotation.kind === 'requirements-section' ||
    annotation.kind === 'requirement' ||
    annotation.kind === 'scenario' ||
    annotation.kind === 'scenario-step' ||
    annotation.kind === 'keyword'
  )
}

function createRequirementAnnotation(
  fact: MarkdownFact,
  confidence: OpenSpecAnnotationConfidence
): OpenSpecAnnotationInput {
  return {
    kind: 'requirement',
    targetFactId: fact.id,
    confidence,
    metadata: { title: stripRequirementPrefix(fact.text) || fact.text },
  }
}

function createScenarioAnnotation(
  fact: MarkdownFact,
  confidence: OpenSpecAnnotationConfidence
): OpenSpecAnnotationInput {
  return {
    kind: 'scenario',
    targetFactId: fact.id,
    confidence,
    metadata: { title: stripScenarioPrefix(fact.text) || 'Scenario' },
  }
}

function matchesAnyTerm(text: string, terms: readonly string[]): boolean {
  const normalized = text.toLowerCase()
  return terms.some((term) => normalized.includes(term))
}

function isExactTerm(text: string, terms: readonly string[]): boolean {
  const normalized = text.trim().toLowerCase()
  return terms.some((term) => normalized === term.toLowerCase())
}

function stripRequirementPrefix(text: string): string {
  return text.replace(REQUIREMENT_PREFIX_PATTERN, '').trim()
}

function stripScenarioPrefix(text: string): string {
  return text.replace(SCENARIO_PREFIX_PATTERN, '').trim()
}

function getHeadingSections(context: MarkdownAnnotationContext): HeadingSection[] {
  const headings = getMarkdownHeadingFacts(context)
  return headings.reduce<HeadingSection[]>((sections, fact, index) => {
    const span = getMarkdownFactSpan(fact)
    if (!span) return sections
    sections.push({
      fact,
      start: span.start,
      end: getMarkdownHeadingEnd(headings, index, context.sourceMarkdown.length),
    })
    return sections
  }, [])
}

function getRequirementSections(context: MarkdownAnnotationContext): HeadingSection[] {
  return getHeadingSections(context).filter((section) =>
    context.getAnnotation(section.fact.id, 'requirements-section')
  )
}

function getChildHeadings(
  context: MarkdownAnnotationContext,
  section: HeadingSection,
  depth: MarkdownFact['depth']
): MarkdownFact[] {
  return getMarkdownHeadingFacts(context).filter((fact) => {
    if (fact.depth !== depth) return false
    const span = getMarkdownFactSpan(fact)
    return !!span && span.start > section.start && span.start < section.end
  })
}

function getRequirementHeadings(context: MarkdownAnnotationContext): MarkdownFact[] {
  return getMarkdownHeadingFacts(context).filter((fact) =>
    context.getAnnotation(fact.id, 'requirement')
  )
}

function getNestedHeadings(
  context: MarkdownAnnotationContext,
  parentHeading: MarkdownFact
): MarkdownFact[] {
  const headings = getMarkdownHeadingFacts(context)
  const parentIndex = headings.findIndex((fact) => fact.id === parentHeading.id)
  const parentSpan = getMarkdownFactSpan(parentHeading)
  if (parentIndex < 0 || !parentSpan) return []
  const end = getMarkdownHeadingEnd(headings, parentIndex, context.sourceMarkdown.length)

  return headings.filter((fact) => {
    const span = getMarkdownFactSpan(fact)
    return !!span && span.start > parentSpan.start && span.start < end
  })
}

function getScenarioSections(context: MarkdownAnnotationContext): HeadingSection[] {
  const headings = getMarkdownHeadingFacts(context)
  return getHeadingSections(context).filter((section) => {
    if (!context.getAnnotation(section.fact.id, 'scenario')) return false
    if (NON_SCENARIO_HEADING_PATTERN.test(section.fact.text)) return false

    const index = headings.findIndex((fact) => fact.id === section.fact.id)
    return index >= 0
  })
}

function hasRequirementBodySignals(
  context: MarkdownAnnotationContext,
  requirementHeading: MarkdownFact,
  sectionEnd: number
): boolean {
  const span = getMarkdownFactSpan(requirementHeading)
  if (!span) return false
  const headings = getMarkdownHeadingFacts(context)
  const index = headings.findIndex((fact) => fact.id === requirementHeading.id)
  const end = index >= 0 ? getMarkdownHeadingEnd(headings, index, sectionEnd) : sectionEnd
  const body = context.sourceMarkdown.slice(span.end, Math.min(end, sectionEnd))
  return REQUIREMENT_BODY_SIGNAL_PATTERN.test(body)
}

function hasScenarioStepSignals(
  context: MarkdownAnnotationContext,
  scenarioHeading: MarkdownFact
): boolean {
  const span = getMarkdownFactSpan(scenarioHeading)
  if (!span) return false
  const headings = getMarkdownHeadingFacts(context)
  const index = headings.findIndex((fact) => fact.id === scenarioHeading.id)
  const end =
    index >= 0
      ? getMarkdownHeadingEnd(headings, index, context.sourceMarkdown.length)
      : context.sourceMarkdown.length
  const body = context.sourceMarkdown.slice(span.end, end)
  return body.split('\n').some((line) => SCENARIO_STEP_PATTERN.test(line))
}

function isWithinAnySection(fact: MarkdownFact, sections: readonly HeadingSection[]): boolean {
  const span = getMarkdownFactSpan(fact)
  if (!span) return false
  return sections.some((section) => span.start > section.start && span.start < section.end)
}

function parseScenarioStepFact(fact: MarkdownFact): OpenSpecAnnotationMetadata | undefined {
  const rawMarkdown = fact.range?.rawMarkdown.trim() || fact.text
  const match = rawMarkdown.match(SCENARIO_STEP_PATTERN) ?? fact.text.match(SCENARIO_STEP_PATTERN)
  if (!match) return undefined

  return {
    keyword: match[1]!.toUpperCase() as OpenSpecScenarioStepKeyword,
    contentMarkdown: match[2]!.trim(),
    rawMarkdown,
  }
}

function canAnnotateInlineKeywords(fact: MarkdownFact): boolean {
  return (
    fact.kind === 'paragraph' ||
    fact.kind === 'listItem' ||
    fact.kind === 'heading' ||
    fact.kind === 'tableCell'
  )
}

function findScenarioStepKeyword(fact: MarkdownFact, keyword: unknown): OpenSpecAnnotationInput[] {
  if (!isScenarioStepKeywordValue(keyword)) return []

  const match = fact.text.match(new RegExp(`^\\s*(${SCENARIO_STEP_KEYWORDS.join('|')})\\b`, 'i'))
  if (!match) return []

  const text = match[1]!
  const textStart = match.index ?? 0
  const sourceSpan = findSourceSpanForFactText(fact, text)

  return [
    {
      kind: 'keyword',
      targetFactId: fact.id,
      ...(sourceSpan ? { sourceSpan } : {}),
      textSpan: { start: textStart, end: textStart + text.length },
      confidence: 'strong',
      metadata: {
        keyword,
        keywordText: text,
        keywordRole: 'scenario-step',
      },
    },
  ]
}

function findRequirementKeywords(fact: MarkdownFact): OpenSpecAnnotationInput[] {
  const span = getMarkdownFactSpan(fact)
  const text = fact.text
  if (!span || !text) return []

  return Array.from(
    text.matchAll(REQUIREMENT_KEYWORD_PATTERN),
    (match): OpenSpecAnnotationInput => {
      const keyword = match[1]!.toUpperCase() as OpenSpecKeyword
      const textStart = match.index!
      const textEnd = textStart + match[1]!.length
      const sourceSpan = findSourceSpanForFactText(fact, match[1]!, textStart)

      return {
        kind: 'keyword',
        targetFactId: fact.id,
        ...(sourceSpan ? { sourceSpan } : {}),
        textSpan: { start: textStart, end: textEnd },
        confidence: 'strong',
        metadata: {
          keyword,
          keywordText: match[1]!,
          keywordRole: isScenarioStepKeyword(keyword) ? 'scenario-step' : 'requirement-modal',
        },
      }
    }
  )
}

function isScenarioStepKeywordValue(value: unknown): value is OpenSpecScenarioStepKeyword {
  return (
    typeof value === 'string' && SCENARIO_STEP_KEYWORDS.some((stepKeyword) => stepKeyword === value)
  )
}

function isScenarioStepKeyword(keyword: OpenSpecKeyword): keyword is OpenSpecScenarioStepKeyword {
  return SCENARIO_STEP_KEYWORDS.some((stepKeyword) => stepKeyword === keyword)
}

function readAnnotationKeyword(metadata: object | undefined): unknown {
  return metadata && 'keyword' in metadata ? metadata.keyword : undefined
}

function findSourceSpanForFactText(
  fact: MarkdownFact,
  text: string,
  textStart = 0
): { start: number; end: number } | undefined {
  const factSpan = getMarkdownFactSpan(fact)
  const rawMarkdown = fact.range?.rawMarkdown
  if (!factSpan || !rawMarkdown) return undefined

  const rawStart = rawMarkdown.indexOf(text, Math.min(textStart, rawMarkdown.length))
  const index = rawStart >= 0 ? rawStart : rawMarkdown.indexOf(text)
  if (index < 0) return undefined

  const start = factSpan.start + index
  return { start, end: start + text.length }
}
