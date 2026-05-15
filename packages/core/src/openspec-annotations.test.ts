import { describe, expect, it } from 'vitest'
import {
  annotateOpenSpecMarkdown,
  getOpenSpecAnnotationsForFact,
  type OpenSpecSemanticKind,
} from './openspec-annotations.js'

describe('annotateOpenSpecMarkdown', () => {
  it('annotates canonical OpenSpec headings strongly', () => {
    const document = annotateOpenSpecMarkdown(`# Reader Spec

## Purpose
Purpose copy.

## Requirements
### Requirement: First capability
The system SHALL read specs.

#### Scenario: Happy path
- WHEN the user opens a spec
- THEN the UI renders it
`)

    const annotationsByKind = new Map<OpenSpecSemanticKind, number>()
    for (const annotation of document.annotations) {
      annotationsByKind.set(annotation.kind, (annotationsByKind.get(annotation.kind) ?? 0) + 1)
    }

    expect(annotationsByKind.get('document-title')).toBe(1)
    expect(annotationsByKind.get('purpose-section')).toBe(1)
    expect(annotationsByKind.get('requirements-section')).toBe(1)
    expect(annotationsByKind.get('requirement')).toBe(1)
    expect(annotationsByKind.get('scenario')).toBe(1)

    const requirement = document.annotations.find((annotation) => annotation.kind === 'requirement')
    expect(requirement).toMatchObject({
      confidence: 'strong',
      ruleId: 'openspec.heading.requirement-prefix.v2',
      metadata: {
        title: 'First capability',
      },
    })
  })

  it('keeps future-looking headings visible as facts when no section rule applies', () => {
    const document = annotateOpenSpecMarkdown(`# Reader Spec

## Guarantees
Future official wording may appear here.

### Future thing
The system SHALL keep this visible.
`)

    const capabilityHeading = document.facts.find((fact) => fact.text === 'Future thing')
    const semanticAnnotations = document.annotations.filter(
      (annotation) => annotation.targetFactId === capabilityHeading?.id
    )

    expect(capabilityHeading).toMatchObject({
      kind: 'heading',
      depth: 3,
      text: 'Future thing',
    })
    expect(semanticAnnotations).toHaveLength(0)
  })

  it('loosely annotates AI-mutated capability/example specs without hiding authored content', () => {
    const document = annotateOpenSpecMarkdown(`# Reader Spec

## Objective
Purpose copy.

## Capabilities
### Capability: Login
The system SHOULD let users sign in.

#### Example: Valid password
- when the user submits valid credentials
- then the session starts

#### Notes
- This is authored context, not a scenario.
`)

    const annotationsByKind = new Map<OpenSpecSemanticKind, number>()
    for (const annotation of document.annotations) {
      annotationsByKind.set(annotation.kind, (annotationsByKind.get(annotation.kind) ?? 0) + 1)
    }

    const requirement = document.annotations.find((annotation) => annotation.kind === 'requirement')
    const scenario = document.annotations.find((annotation) => annotation.kind === 'scenario')
    const notes = document.facts.find((fact) => fact.kind === 'heading' && fact.text === 'Notes')

    expect(annotationsByKind.get('purpose-section')).toBe(1)
    expect(annotationsByKind.get('requirements-section')).toBe(1)
    expect(requirement).toMatchObject({
      confidence: 'weak',
      metadata: { title: 'Login' },
    })
    expect(scenario).toMatchObject({
      confidence: 'weak',
      metadata: { title: 'Valid password' },
    })
    expect(
      document.annotations.filter((annotation) => annotation.kind === 'scenario-step')
    ).toHaveLength(2)
    expect(getOpenSpecAnnotationsForFact(document, notes!.id)).toHaveLength(0)
  })

  it('attaches scenario step annotations to list item facts', () => {
    const document = annotateOpenSpecMarkdown(`# Reader Spec

## Requirements
### Requirement: Steps
The system SHALL expose steps.

#### Scenario: Keyword steps
- **GIVEN** a saved spec
- **WHEN** the reader opens the spec page
- A normal markdown list item
`)

    const steps = document.annotations.filter((annotation) => annotation.kind === 'scenario-step')
    const stepFacts = steps.map((step) =>
      document.facts.find((fact) => fact.id === step.targetFactId)
    )

    expect(steps).toHaveLength(2)
    expect(steps.map((step) => step.metadata?.keyword)).toEqual(['GIVEN', 'WHEN'])
    expect(stepFacts.every((fact) => fact?.kind === 'listItem')).toBe(true)
    expect(stepFacts.map((fact) => fact?.text)).toEqual([
      'GIVEN a saved spec',
      'WHEN the reader opens the spec page',
    ])
  })

  it('annotates OpenSpec keywords as inline semantic spans without reading code fences', () => {
    const document = annotateOpenSpecMarkdown(`# Reader Spec

## Requirements
### Requirement: Keyword spans
The system SHALL preserve SHOULD wording and MAY evolve.

#### Scenario: Keyword steps
- **WHEN** the reader opens a spec
- **THEN** the UI renders it

\`\`\`md
The system SHALL not annotate this fenced example.
- WHEN fake code runs
\`\`\`
`)

    const keywords = document.annotations.filter((annotation) => annotation.kind === 'keyword')
    const keywordsByText = keywords.map((annotation) => annotation.metadata?.keyword)

    expect(keywordsByText).toEqual(['WHEN', 'THEN', 'SHALL', 'SHOULD', 'MAY'])
    expect(keywords.every((annotation) => annotation.textSpan)).toBe(true)
    expect(
      keywords.some((annotation) => {
        const fact = document.facts.find((candidate) => candidate.id === annotation.targetFactId)
        return fact?.kind === 'code'
      })
    ).toBe(false)
  })

  it('does not force notes headings inside requirements into scenarios', () => {
    const document = annotateOpenSpecMarkdown(`# Reader Spec

## Requirements
### Requirement: Notes stay plain
The system SHALL preserve nested notes.

#### Notes
- This is authored body content.

#### Scenario: Explicit scenario
- WHEN the scenario is parsed
- THEN it is the only scenario
`)

    const notes = document.facts.find((fact) => fact.kind === 'heading' && fact.text === 'Notes')
    const scenarios = document.annotations.filter((annotation) => annotation.kind === 'scenario')
    const notesAnnotations = getOpenSpecAnnotationsForFact(document, notes!.id)

    expect(scenarios).toHaveLength(1)
    expect(scenarios[0]!.metadata?.title).toBe('Explicit scenario')
    expect(notesAnnotations).toHaveLength(0)
  })
})
