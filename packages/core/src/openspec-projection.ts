import type { MarkdownFact } from './markdown-facts.js'
import {
  createMarkdownReadingDocument,
  getMarkdownFactSpan,
  getMarkdownHeadingEnd,
  getMarkdownHeadingFacts,
  trimMarkdownSlice,
  type MarkdownProjectionContext,
  type MarkdownProjectionRule,
  type MarkdownReadingDocument,
  type MarkdownReadingPlugin,
} from './markdown-reading.js'
import {
  builtinOpenSpecReadingPlugin,
  type AnnotatedOpenSpecDocument,
  type OpenSpecAnnotation,
  type OpenSpecScenarioStepKeyword,
} from './openspec-annotations.js'
import type { Requirement, ScenarioStep, Spec } from './schemas.js'

export const OPEN_SPEC_SPEC_PROJECTION_ID = 'openspec.projection.spec.v2'
export const OPEN_SPEC_READING_SECTIONS_PROJECTION_ID = 'openspec.projection.reading-sections.v2'

interface FactSpan {
  start: number
  end: number
}

type SpecSectionKind = 'overview' | 'requirements' | 'other'

export interface OpenSpecProjectionOptions {
  specId: string
}

export interface OpenSpecHeadingSection {
  id: string
  title: string
  kind: SpecSectionKind
  factId: string
  start: number
  end: number
}

export interface OpenSpecRequirementBlock {
  id: string
  title: string
  factId: string
  start: number
  end: number
  scenarios: OpenSpecScenarioBlock[]
}

export interface OpenSpecScenarioBlock {
  title: string
  factId: string
  start: number
  end: number
}

export interface OpenSpecReadingSectionsProjection {
  sections: OpenSpecHeadingSection[]
  requirements: OpenSpecRequirementBlock[]
}

export interface ProjectedOpenSpecDocument extends MarkdownReadingDocument {
  annotations: OpenSpecAnnotation[]
  projections: MarkdownReadingDocument['projections'] & {
    [OPEN_SPEC_SPEC_PROJECTION_ID]?: Spec
    [OPEN_SPEC_READING_SECTIONS_PROJECTION_ID]?: OpenSpecReadingSectionsProjection
  }
}

export function createOpenSpecReadingPlugin(
  options: OpenSpecProjectionOptions
): MarkdownReadingPlugin {
  return {
    ...builtinOpenSpecReadingPlugin,
    id: 'openspec.builtin-reading-with-projections.v2',
    projectionRules: [
      createOpenSpecReadingSectionsProjectionRule(),
      createOpenSpecSpecProjectionRule(options),
    ],
  }
}

export function parseOpenSpecMarkdownToSpec(specId: string, content: string): Spec {
  return projectOpenSpecMarkdown(content, { specId }).projections[OPEN_SPEC_SPEC_PROJECTION_ID]!
}

export function projectOpenSpecMarkdown(
  sourceMarkdown: string,
  options: OpenSpecProjectionOptions,
  plugins: readonly MarkdownReadingPlugin[] = [createOpenSpecReadingPlugin(options)]
): ProjectedOpenSpecDocument {
  return toProjectedOpenSpecDocument(createMarkdownReadingDocument(sourceMarkdown, plugins))
}

export function projectAnnotatedOpenSpecToSpec(
  specId: string,
  document: AnnotatedOpenSpecDocument
): Spec {
  const context = createDetachedProjectionContext(document)
  return projectOpenSpecContextToSpec(context, { specId })
}

export function getOpenSpecReadingSections(
  document: Pick<MarkdownReadingDocument, 'facts' | 'annotations' | 'sourceMarkdown'>
): OpenSpecReadingSectionsProjection {
  const context = createDetachedProjectionContext(document)
  return {
    sections: collectSpecSections(context),
    requirements: collectRequirementBlocks(context),
  }
}

export function getOpenSpecProjectionAnnotation(
  annotations: readonly OpenSpecAnnotation[],
  factId: string,
  kind: OpenSpecAnnotation['kind']
): OpenSpecAnnotation | undefined {
  return annotations.find(
    (annotation) => annotation.targetFactId === factId && annotation.kind === kind
  )
}

function createOpenSpecReadingSectionsProjectionRule(): MarkdownProjectionRule<OpenSpecReadingSectionsProjection> {
  return {
    id: OPEN_SPEC_READING_SECTIONS_PROJECTION_ID,
    project(context) {
      return {
        sections: collectSpecSections(toOpenSpecProjectionContext(context)),
        requirements: collectRequirementBlocks(toOpenSpecProjectionContext(context)),
      }
    },
  }
}

function createOpenSpecSpecProjectionRule(
  options: OpenSpecProjectionOptions
): MarkdownProjectionRule<Spec> {
  return {
    id: OPEN_SPEC_SPEC_PROJECTION_ID,
    project(context) {
      return projectOpenSpecContextToSpec(toOpenSpecProjectionContext(context), options)
    },
  }
}

function projectOpenSpecContextToSpec(
  context: OpenSpecProjectionContext,
  options: OpenSpecProjectionOptions
): Spec {
  const titleAnnotation = context.annotations.find(
    (annotation) => annotation.kind === 'document-title'
  )
  const name = titleAnnotation?.metadata?.title || options.specId
  const overviewSection = collectSpecSections(context).find(
    (section) => section.kind === 'overview'
  )
  const overview = overviewSection
    ? trimMarkdownSlice(
        context.sourceMarkdown,
        getContentStartAfterHeading(context, overviewSection.factId, overviewSection.start),
        overviewSection.end
      )
    : ''

  const requirements = collectRequirementBlocks(context).map((requirement) =>
    projectRequirement(context, requirement)
  )

  return {
    id: options.specId,
    name: name || options.specId,
    overview: overview.trim(),
    requirements,
    metadata: {
      version: '1.0.0',
      format: 'openspec',
    },
  }
}

function createRequirementText(title: string, bodyMarkdown: string, scenarioText: string): string {
  return [title, bodyMarkdown, scenarioText].filter((part) => part.trim()).join('\n\n')
}

function collectSpecSections(context: OpenSpecProjectionContext): OpenSpecHeadingSection[] {
  const headings = getMarkdownHeadingFacts(context)
  return headings.reduce<OpenSpecHeadingSection[]>((sections, fact, index) => {
    if (fact.depth !== 2) return sections
    const span = getFactSpan(fact)
    if (!span) return sections
    sections.push({
      id: fact.id,
      title: fact.text,
      kind: getSectionKind(context.annotations, fact.id),
      factId: fact.id,
      start: span.start,
      end: getMarkdownHeadingEnd(headings, index, context.sourceMarkdown.length),
    })
    return sections
  }, [])
}

function collectRequirementBlocks(context: OpenSpecProjectionContext): OpenSpecRequirementBlock[] {
  const headings = getMarkdownHeadingFacts(context)
  let reqIndex = 0

  return headings.reduce<OpenSpecRequirementBlock[]>((requirements, fact, index) => {
    const annotation = getOpenSpecProjectionAnnotation(context.annotations, fact.id, 'requirement')
    if (!annotation) return requirements
    const span = getFactSpan(fact)
    if (!span) return requirements

    reqIndex++
    const end = getMarkdownHeadingEnd(headings, index, context.sourceMarkdown.length)
    const title = annotation.metadata?.title?.trim() || fact.text
    requirements.push({
      id: `req-${reqIndex}`,
      title,
      factId: fact.id,
      start: span.start,
      end,
      scenarios: collectScenarioBlocks(context, headings, fact, end),
    })
    return requirements
  }, [])
}

function collectScenarioBlocks(
  context: OpenSpecProjectionContext,
  headings: MarkdownFact[],
  requirementFact: MarkdownFact,
  requirementEnd: number
): OpenSpecScenarioBlock[] {
  const requirementSpan = getFactSpan(requirementFact)
  if (!requirementSpan) return []

  return headings.reduce<OpenSpecScenarioBlock[]>((scenarios, fact, index) => {
    const annotation = getOpenSpecProjectionAnnotation(context.annotations, fact.id, 'scenario')
    if (!annotation) return scenarios

    const span = getFactSpan(fact)
    if (!span || span.start <= requirementSpan.start || span.start >= requirementEnd) {
      return scenarios
    }

    scenarios.push({
      title: annotation.metadata?.title?.trim() || fact.text,
      factId: fact.id,
      start: span.start,
      end: Math.min(getScenarioEnd(context, headings, index, requirementEnd), requirementEnd),
    })
    return scenarios
  }, [])
}

function getScenarioEnd(
  context: OpenSpecProjectionContext,
  headings: MarkdownFact[],
  scenarioIndex: number,
  requirementEnd: number
): number {
  for (let i = scenarioIndex + 1; i < headings.length; i++) {
    const next = headings[i]!
    const nextSpan = getFactSpan(next)
    if (!nextSpan || nextSpan.start >= requirementEnd) {
      return requirementEnd
    }

    if (
      (next.depth ?? 6) <= 3 ||
      getOpenSpecProjectionAnnotation(context.annotations, next.id, 'scenario')
    ) {
      return nextSpan.start
    }
  }

  return requirementEnd
}

function getContentStartAfterHeading(
  context: OpenSpecProjectionContext,
  factId: string,
  fallback: number
): number {
  const fact = context.factById.get(factId)
  return fact ? (getFactSpan(fact)?.end ?? fallback) : fallback
}

function projectScenario(
  context: OpenSpecProjectionContext,
  scenario: OpenSpecScenarioBlock
): Requirement['scenarios'][number] {
  const bodyMarkdown = trimMarkdownSlice(
    context.sourceMarkdown,
    getContentStartAfterHeading(context, scenario.factId, scenario.start),
    scenario.end
  )
  const rawText = [scenario.title, bodyMarkdown].filter((part) => part.trim()).join('\n')

  return {
    title: scenario.title,
    bodyMarkdown,
    rawText,
    steps: getScenarioStepsFromAnnotations(context, scenario),
  }
}

function getScenarioStepsFromAnnotations(
  context: OpenSpecProjectionContext,
  scenario: OpenSpecScenarioBlock
): ScenarioStep[] {
  return context.annotations.reduce<ScenarioStep[]>((steps, annotation) => {
    if (annotation.kind !== 'scenario-step') return steps
    const fact = context.factById.get(annotation.targetFactId)
    const span = fact ? getFactSpan(fact) : undefined
    if (!span || span.start <= scenario.start || span.start >= scenario.end) {
      return steps
    }
    const keyword = annotation.metadata?.keyword
    const contentMarkdown = annotation.metadata?.contentMarkdown
    const rawText = annotation.metadata?.rawMarkdown
    if (!isScenarioStepKeyword(keyword) || !contentMarkdown || !rawText) {
      return steps
    }

    steps.push({
      keyword,
      contentMarkdown,
      rawText,
    })
    return steps
  }, [])
}

function isScenarioStepKeyword(value: unknown): value is OpenSpecScenarioStepKeyword {
  return (
    value === 'GIVEN' || value === 'WHEN' || value === 'THEN' || value === 'AND' || value === 'BUT'
  )
}

function projectRequirement(
  context: OpenSpecProjectionContext,
  requirement: OpenSpecRequirementBlock
): Requirement {
  const firstScenarioStart = requirement.scenarios
    .map((scenario) => scenario.start)
    .sort((left, right) => left - right)[0]
  const bodyEnd = firstScenarioStart ?? requirement.end
  const bodyMarkdown = trimMarkdownSlice(
    context.sourceMarkdown,
    getContentStartAfterHeading(context, requirement.factId, requirement.start),
    bodyEnd
  )
  const scenarios = requirement.scenarios.map((scenario) => projectScenario(context, scenario))
  const scenarioText = scenarios.map((scenario) => scenario.rawText).join('\n\n')

  return {
    id: requirement.id,
    title: requirement.title,
    bodyMarkdown,
    text: createRequirementText(requirement.title, bodyMarkdown, scenarioText),
    scenarios,
  }
}

function getFactSpan(fact: MarkdownFact): FactSpan | undefined {
  return getMarkdownFactSpan(fact)
}

function getSectionKind(
  annotations: readonly OpenSpecAnnotation[],
  factId: string
): SpecSectionKind {
  if (getOpenSpecProjectionAnnotation(annotations, factId, 'purpose-section')) return 'overview'
  if (getOpenSpecProjectionAnnotation(annotations, factId, 'requirements-section')) {
    return 'requirements'
  }
  return 'other'
}

interface OpenSpecProjectionContext {
  sourceMarkdown: string
  facts: readonly MarkdownFact[]
  factById: ReadonlyMap<string, MarkdownFact>
  annotations: readonly OpenSpecAnnotation[]
}

function createDetachedProjectionContext(
  document: Pick<MarkdownReadingDocument, 'facts' | 'annotations' | 'sourceMarkdown'>
): OpenSpecProjectionContext {
  return {
    sourceMarkdown: document.sourceMarkdown,
    facts: document.facts,
    factById: new Map(document.facts.map((fact) => [fact.id, fact])),
    annotations: document.annotations.filter(isOpenSpecAnnotation),
  }
}

function toOpenSpecProjectionContext(
  context: MarkdownProjectionContext
): OpenSpecProjectionContext {
  return {
    sourceMarkdown: context.sourceMarkdown,
    facts: context.facts,
    factById: context.factById,
    annotations: context.annotations.filter(isOpenSpecAnnotation),
  }
}

function toProjectedOpenSpecDocument(document: MarkdownReadingDocument): ProjectedOpenSpecDocument {
  return {
    ...document,
    annotations: document.annotations.filter(isOpenSpecAnnotation),
  }
}

function isOpenSpecAnnotation(
  annotation: MarkdownReadingDocument['annotations'][number]
): annotation is OpenSpecAnnotation {
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
