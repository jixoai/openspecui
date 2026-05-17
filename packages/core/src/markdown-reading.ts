import {
  parseMarkdownFacts,
  type MarkdownFact,
  type MarkdownFactsDocument,
} from './markdown-facts.js'

export type MarkdownAnnotationConfidence = 'strong' | 'weak'

export interface MarkdownAnnotation<
  Kind extends string = string,
  Metadata extends object = object,
> {
  id: string
  kind: Kind
  targetFactId: string
  sourceSpan?: MarkdownFactSpan
  textSpan?: MarkdownFactSpan
  ruleId: string
  confidence: MarkdownAnnotationConfidence
  metadata?: Readonly<Metadata>
}

export interface MarkdownAnnotationInput<
  Kind extends string = string,
  Metadata extends object = object,
> {
  kind: Kind
  targetFactId: string
  sourceSpan?: MarkdownFactSpan
  textSpan?: MarkdownFactSpan
  confidence: MarkdownAnnotationConfidence
  metadata?: Readonly<Metadata>
}

export interface MarkdownReadingLookup {
  sourceMarkdown: string
  rootId: string
  facts: readonly MarkdownFact[]
  factById: ReadonlyMap<string, MarkdownFact>
  parentById: ReadonlyMap<string, MarkdownFact>
}

export interface MarkdownAnnotationContext extends MarkdownReadingLookup {
  previousAnnotations: readonly MarkdownAnnotation[]
  getAnnotationsForFact(factId: string, kind?: string): MarkdownAnnotation[]
  getAnnotation(factId: string, kind: string): MarkdownAnnotation | undefined
}

export interface MarkdownProjectionContext extends MarkdownReadingLookup {
  annotations: readonly MarkdownAnnotation[]
  projections: Readonly<Record<string, unknown>>
  getAnnotationsForFact(factId: string, kind?: string): MarkdownAnnotation[]
  getAnnotation(factId: string, kind: string): MarkdownAnnotation | undefined
}

export interface MarkdownAnnotationRule {
  id: string
  annotate(context: MarkdownAnnotationContext): readonly MarkdownAnnotationInput[]
}

export interface MarkdownProjectionRule<Output = unknown> {
  id: string
  project(context: MarkdownProjectionContext): Output | undefined
}

export interface MarkdownReadingPlugin {
  id: string
  order?: number
  annotationRules?: readonly MarkdownAnnotationRule[]
  projectionRules?: readonly MarkdownProjectionRule[]
}

export interface MarkdownReadingDocument extends MarkdownFactsDocument {
  annotations: MarkdownAnnotation[]
  projections: Record<string, unknown>
}

export interface MarkdownFactSpan {
  start: number
  end: number
}

export class MarkdownReadingPluginRegistry {
  private plugins = new Map<string, MarkdownReadingPlugin>()

  constructor(plugins: readonly MarkdownReadingPlugin[] = []) {
    for (const plugin of plugins) {
      this.register(plugin)
    }
  }

  register(plugin: MarkdownReadingPlugin): void {
    this.plugins.set(plugin.id, plugin)
  }

  resolve(): MarkdownReadingPlugin[] {
    return sortMarkdownReadingPlugins(Array.from(this.plugins.values()))
  }
}

export function sortMarkdownReadingPlugins(
  plugins: readonly MarkdownReadingPlugin[]
): MarkdownReadingPlugin[] {
  return [...plugins].sort((left, right) => {
    const orderDiff = (left.order ?? 0) - (right.order ?? 0)
    return orderDiff === 0 ? left.id.localeCompare(right.id) : orderDiff
  })
}

export function createMarkdownReadingDocument(
  sourceMarkdown: string,
  plugins: readonly MarkdownReadingPlugin[] = []
): MarkdownReadingDocument {
  return createMarkdownReadingDocumentFromFacts(parseMarkdownFacts(sourceMarkdown), plugins)
}

export function createMarkdownReadingDocumentFromFacts(
  factsDocument: MarkdownFactsDocument,
  plugins: readonly MarkdownReadingPlugin[] = []
): MarkdownReadingDocument {
  const orderedPlugins = sortMarkdownReadingPlugins(plugins)
  const lookup = createLookup(factsDocument)
  const annotations: MarkdownAnnotation[] = []

  for (const rule of orderedPlugins.flatMap((plugin) => plugin.annotationRules ?? [])) {
    const context = createAnnotationContext(lookup, annotations)
    for (const input of rule.annotate(context)) {
      annotations.push({
        id: `${rule.id}:${annotations.length + 1}`,
        ruleId: rule.id,
        kind: input.kind,
        targetFactId: input.targetFactId,
        ...(input.sourceSpan ? { sourceSpan: input.sourceSpan } : {}),
        ...(input.textSpan ? { textSpan: input.textSpan } : {}),
        confidence: input.confidence,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      })
    }
  }

  const projections: Record<string, unknown> = {}
  for (const rule of orderedPlugins.flatMap((plugin) => plugin.projectionRules ?? [])) {
    const context = createProjectionContext(lookup, annotations, projections)
    const output = rule.project(context)
    if (output !== undefined) {
      projections[rule.id] = output
    }
  }

  return {
    ...factsDocument,
    annotations,
    projections,
  }
}

export function getMarkdownFactSpan(fact: MarkdownFact): MarkdownFactSpan | undefined {
  const start = fact.range?.start.offset
  const end = fact.range?.end.offset
  if (typeof start !== 'number' || typeof end !== 'number') return undefined
  return { start, end }
}

export function trimMarkdownSlice(sourceMarkdown: string, start: number, end: number): string {
  return sourceMarkdown.slice(start, Math.max(start, end)).trim()
}

export function getMarkdownHeadingFacts(document: { facts: readonly MarkdownFact[] }) {
  return document.facts.filter((fact) => fact.kind === 'heading' && typeof fact.depth === 'number')
}

export function getMarkdownHeadingEnd(
  headings: readonly MarkdownFact[],
  index: number,
  sourceLength: number
): number {
  const heading = headings[index]
  if (!heading) return sourceLength
  const headingDepth = heading.depth ?? 6

  for (let i = index + 1; i < headings.length; i++) {
    const next = headings[i]
    if (next && (next.depth ?? 6) <= headingDepth) {
      return getMarkdownFactSpan(next)?.start ?? sourceLength
    }
  }

  return sourceLength
}

export function getMarkdownAnnotationsForFact(
  annotations: readonly MarkdownAnnotation[],
  factId: string,
  kind?: string
): MarkdownAnnotation[] {
  return annotations.filter(
    (annotation) => annotation.targetFactId === factId && (!kind || annotation.kind === kind)
  )
}

export function getMarkdownAnnotation(
  annotations: readonly MarkdownAnnotation[],
  factId: string,
  kind: string
): MarkdownAnnotation | undefined {
  return annotations.find(
    (annotation) => annotation.targetFactId === factId && annotation.kind === kind
  )
}

export function buildMarkdownParentMap(facts: readonly MarkdownFact[]): Map<string, MarkdownFact> {
  const factById = new Map(facts.map((fact) => [fact.id, fact]))
  const parentById = new Map<string, MarkdownFact>()

  for (const fact of facts) {
    if (!fact.parentId) continue
    const parent = factById.get(fact.parentId)
    if (parent) {
      parentById.set(fact.id, parent)
    }
  }

  return parentById
}

function createLookup(document: MarkdownFactsDocument): MarkdownReadingLookup {
  return {
    sourceMarkdown: document.sourceMarkdown,
    rootId: document.rootId,
    facts: document.facts,
    factById: new Map(document.facts.map((fact) => [fact.id, fact])),
    parentById: buildMarkdownParentMap(document.facts),
  }
}

function createAnnotationContext(
  lookup: MarkdownReadingLookup,
  previousAnnotations: readonly MarkdownAnnotation[]
): MarkdownAnnotationContext {
  return {
    ...lookup,
    previousAnnotations,
    getAnnotationsForFact: (factId, kind) =>
      getMarkdownAnnotationsForFact(previousAnnotations, factId, kind),
    getAnnotation: (factId, kind) => getMarkdownAnnotation(previousAnnotations, factId, kind),
  }
}

function createProjectionContext(
  lookup: MarkdownReadingLookup,
  annotations: readonly MarkdownAnnotation[],
  projections: Readonly<Record<string, unknown>>
): MarkdownProjectionContext {
  return {
    ...lookup,
    annotations,
    projections,
    getAnnotationsForFact: (factId, kind) =>
      getMarkdownAnnotationsForFact(annotations, factId, kind),
    getAnnotation: (factId, kind) => getMarkdownAnnotation(annotations, factId, kind),
  }
}
