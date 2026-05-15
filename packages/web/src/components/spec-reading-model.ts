import type { Spec } from '@openspecui/core'
import type { MarkdownFact } from '@openspecui/core/markdown-facts'
import {
  getMarkdownFactSpan,
  getMarkdownHeadingEnd,
  getMarkdownHeadingFacts,
  trimMarkdownSlice,
} from '@openspecui/core/markdown-reading'
import {
  type AnnotatedOpenSpecDocument,
  type OpenSpecAnnotation,
} from '@openspecui/core/openspec-annotations'
import { projectOpenSpecMarkdown } from '@openspecui/core/openspec-projection'

export type ScenarioStepKeyword = 'GIVEN' | 'WHEN' | 'THEN' | 'AND' | 'BUT'

export interface SpecReadingStep {
  keyword: ScenarioStepKeyword
  contentMarkdown: string
  rawText: string
}

export interface SpecReadingScenario {
  id: string
  title: string
  bodyMarkdown: string
  residualBodyMarkdown: string
  rawText: string
  steps: SpecReadingStep[]
}

export interface SpecReadingRequirement {
  id: string
  index: number
  label: string
  title: string
  bodyMarkdown: string
  scenarios: SpecReadingScenario[]
}

export interface SpecReadingModel {
  id: string
  name: string
  overviewMarkdown: string
  extraMarkdownBeforeRequirements: string
  requirementsIntroMarkdown: string
  extraMarkdownAfterRequirements: string
  requirements: SpecReadingRequirement[]
}

export function formatRequirementLabel(index: number): string {
  return `REQ-${String(index + 1).padStart(2, '0')}`
}

function decrementLineCount(map: Map<string, number>, line: string): boolean {
  const count = map.get(line) ?? 0
  if (count === 0) return false
  if (count === 1) {
    map.delete(line)
  } else {
    map.set(line, count - 1)
  }
  return true
}

export function createScenarioResidualBodyMarkdown(
  bodyMarkdown: string,
  steps: SpecReadingStep[]
): string {
  if (steps.length === 0) return bodyMarkdown

  const pendingStepLines = new Map<string, number>()
  for (const step of steps) {
    const key = step.rawText.trim()
    pendingStepLines.set(key, (pendingStepLines.get(key) ?? 0) + 1)
  }

  return bodyMarkdown
    .split('\n')
    .filter((line) => !decrementLineCount(pendingStepLines, line.trim()))
    .join('\n')
    .trim()
}

interface ExtraMarkdownSections {
  beforeRequirements: string
  requirementsIntro: string
  afterRequirements: string
}

export function extractExtraMarkdownSections(markdown: string): ExtraMarkdownSections {
  if (!markdown.trim()) {
    return { beforeRequirements: '', requirementsIntro: '', afterRequirements: '' }
  }

  return extractExtraMarkdownSectionsFromAnnotatedDocument(
    projectOpenSpecMarkdown(markdown, { specId: 'inline' })
  )
}

interface FactSpan {
  start: number
  end: number
}

interface HeadingSection {
  fact: MarkdownFact
  start: number
  end: number
}

function getFactSpan(fact: MarkdownFact): FactSpan | undefined {
  return getMarkdownFactSpan(fact)
}

function getAnnotation(
  document: AnnotatedOpenSpecDocument,
  factId: string,
  kind: OpenSpecAnnotation['kind']
): OpenSpecAnnotation | undefined {
  return document.annotations.find(
    (annotation) => annotation.targetFactId === factId && annotation.kind === kind
  )
}

function getHeadingFacts(document: AnnotatedOpenSpecDocument): MarkdownFact[] {
  return getMarkdownHeadingFacts(document)
}

function getHeadingEnd(facts: MarkdownFact[], index: number, sourceLength: number): number {
  return getMarkdownHeadingEnd(facts, index, sourceLength)
}

function getSecondLevelSections(document: AnnotatedOpenSpecDocument): HeadingSection[] {
  const headings = getHeadingFacts(document)
  return headings.reduce<HeadingSection[]>((sections, fact, index) => {
    if (fact.depth !== 2) return sections
    const span = getFactSpan(fact)
    if (!span) return sections
    sections.push({
      fact,
      start: span.start,
      end: getHeadingEnd(headings, index, document.sourceMarkdown.length),
    })
    return sections
  }, [])
}

function extractRequirementsIntroFromSection(
  document: AnnotatedOpenSpecDocument,
  section: HeadingSection
): string {
  const headings = getHeadingFacts(document)
  const firstRequirement = headings.find((fact) => {
    if (fact.depth !== 3) return false
    const span = getFactSpan(fact)
    return (
      !!span &&
      span.start > section.start &&
      span.start < section.end &&
      !!getAnnotation(document, fact.id, 'requirement')
    )
  })
  const headingEnd = getFactSpan(section.fact)?.end ?? section.start
  const introEnd = firstRequirement
    ? (getFactSpan(firstRequirement)?.start ?? section.end)
    : section.end

  return trimMarkdownSlice(document.sourceMarkdown, headingEnd, introEnd)
}

export function extractExtraMarkdownSectionsFromAnnotatedDocument(
  document: AnnotatedOpenSpecDocument
): ExtraMarkdownSections {
  const beforeRequirements: string[] = []
  const afterRequirements: string[] = []
  let requirementsIntro = ''
  let hasSeenRequirements = false

  for (const section of getSecondLevelSections(document)) {
    if (getAnnotation(document, section.fact.id, 'purpose-section')) continue

    if (getAnnotation(document, section.fact.id, 'requirements-section')) {
      hasSeenRequirements = true
      requirementsIntro = extractRequirementsIntroFromSection(document, section)
      continue
    }

    const markdown = trimMarkdownSlice(document.sourceMarkdown, section.start, section.end)
    if (hasSeenRequirements) {
      afterRequirements.push(markdown)
    } else {
      beforeRequirements.push(markdown)
    }
  }

  return {
    beforeRequirements: beforeRequirements.join('\n\n').trim(),
    requirementsIntro,
    afterRequirements: afterRequirements.join('\n\n').trim(),
  }
}

export function createSpecReadingModel(
  spec: Spec,
  sourceMarkdown = '',
  annotatedDocument?: AnnotatedOpenSpecDocument
): SpecReadingModel {
  const extraMarkdown = annotatedDocument
    ? extractExtraMarkdownSectionsFromAnnotatedDocument(annotatedDocument)
    : sourceMarkdown.trim()
      ? extractExtraMarkdownSections(sourceMarkdown)
      : { beforeRequirements: '', requirementsIntro: '', afterRequirements: '' }

  return {
    id: spec.id,
    name: spec.name,
    overviewMarkdown: spec.overview,
    extraMarkdownBeforeRequirements: extraMarkdown.beforeRequirements,
    requirementsIntroMarkdown: extraMarkdown.requirementsIntro,
    extraMarkdownAfterRequirements: extraMarkdown.afterRequirements,
    requirements: spec.requirements.map((requirement, index) => ({
      id: requirement.id,
      index,
      label: formatRequirementLabel(index),
      title: requirement.title,
      bodyMarkdown: requirement.bodyMarkdown,
      scenarios: requirement.scenarios.map((scenario, scenarioIndex) => ({
        id: `${requirement.id}-scenario-${scenarioIndex + 1}`,
        title: scenario.title,
        bodyMarkdown: scenario.bodyMarkdown,
        residualBodyMarkdown: createScenarioResidualBodyMarkdown(
          scenario.bodyMarkdown,
          scenario.steps ?? []
        ),
        rawText: scenario.rawText,
        steps: scenario.steps ?? [],
      })),
    })),
  }
}
