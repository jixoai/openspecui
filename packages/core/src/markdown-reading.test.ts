import { describe, expect, it } from 'vitest'
import {
  createMarkdownReadingDocument,
  type MarkdownAnnotationRule,
  type MarkdownProjectionRule,
  type MarkdownReadingPlugin,
} from './markdown-reading.js'

describe('createMarkdownReadingDocument', () => {
  it('runs annotation and projection rules as ordered plugins', () => {
    const markCapabilities: MarkdownAnnotationRule = {
      id: 'community.capability-heading',
      annotate(context) {
        return context.facts.flatMap((fact) => {
          if (fact.kind !== 'heading' || !fact.text.startsWith('Capability:')) return []
          return [
            {
              kind: 'community-capability',
              targetFactId: fact.id,
              confidence: 'strong',
              metadata: { title: fact.text.replace(/^Capability:\s*/, '') },
            },
          ]
        })
      },
    }

    const projectCapabilities: MarkdownProjectionRule<string[]> = {
      id: 'community.capabilities',
      project(context) {
        return context.annotations
          .filter((annotation) => annotation.kind === 'community-capability')
          .map((annotation) => {
            const title = annotation.metadata?.title
            return typeof title === 'string'
              ? title
              : context.factById.get(annotation.targetFactId)?.text
          })
          .filter((title): title is string => !!title)
      },
    }

    const plugin: MarkdownReadingPlugin = {
      id: 'community',
      annotationRules: [markCapabilities],
      projectionRules: [projectCapabilities],
    }

    const document = createMarkdownReadingDocument(
      `# Spec

### Capability: Community parser
`,
      [plugin]
    )

    expect(document.annotations).toMatchObject([
      {
        kind: 'community-capability',
        targetFactId: expect.any(String) as string,
        ruleId: 'community.capability-heading',
        confidence: 'strong',
      },
    ])
    expect(document.projections['community.capabilities']).toEqual(['Community parser'])
  })

  it('lets later rules depend on previous annotations without hiding unknown markdown facts', () => {
    const plugin: MarkdownReadingPlugin = {
      id: 'pipeline',
      annotationRules: [
        {
          id: 'pipeline.first',
          annotate(context) {
            return context.facts
              .filter((fact) => fact.kind === 'heading' && fact.depth === 2)
              .map((fact) => ({
                kind: 'section',
                targetFactId: fact.id,
                confidence: 'weak' as const,
              }))
          },
        },
        {
          id: 'pipeline.second',
          annotate(context) {
            return context.previousAnnotations.map((annotation) => ({
              kind: 'derived-section',
              targetFactId: annotation.targetFactId,
              confidence: 'weak' as const,
            }))
          },
        },
      ],
    }

    const document = createMarkdownReadingDocument(
      `<div data-future="true">
Unknown extension content
</div>

## Real section
`,
      [plugin]
    )

    expect(document.annotations.map((annotation) => annotation.kind)).toEqual([
      'section',
      'derived-section',
    ])
    expect(
      document.facts.some((fact) => fact.kind === 'html' && fact.text.includes('future'))
    ).toBe(true)
  })
})
