import type { Spec } from '@openspecui/core'
import { projectOpenSpecMarkdown } from '@openspecui/core/openspec-projection'
import { describe, expect, it } from 'vitest'
import {
  createScenarioResidualBodyMarkdown,
  createSpecReadingModel,
  extractExtraMarkdownSections,
  extractExtraMarkdownSectionsFromAnnotatedDocument,
  formatRequirementLabel,
} from './spec-reading-model'

describe('spec reading model', () => {
  it('formats stable requirement labels', () => {
    expect(formatRequirementLabel(0)).toBe('REQ-01')
    expect(formatRequirementLabel(11)).toBe('REQ-12')
  })

  it('maps parsed spec facts into reading blocks', () => {
    const spec: Spec = {
      id: 'reader',
      name: 'Reader Spec',
      overview: 'Purpose markdown',
      requirements: [
        {
          id: 'req-1',
          title: 'Read requirement',
          bodyMarkdown: 'The system SHALL read specs.',
          text: 'Read requirement',
          scenarios: [
            {
              title: 'Scenario title',
              bodyMarkdown: '- WHEN the reader opens\n- THEN it renders',
              rawText: 'Scenario title\n- WHEN the reader opens\n- THEN it renders',
              steps: [
                {
                  keyword: 'WHEN',
                  contentMarkdown: 'the reader opens',
                  rawText: '- WHEN the reader opens',
                },
              ],
            },
          ],
        },
      ],
    }

    const model = createSpecReadingModel(spec)

    expect(model.overviewMarkdown).toBe('Purpose markdown')
    expect(model.requirements[0]).toMatchObject({
      label: 'REQ-01',
      title: 'Read requirement',
    })
    expect(model.requirements[0]!.scenarios[0]!.steps[0]).toMatchObject({
      keyword: 'WHEN',
      contentMarkdown: 'the reader opens',
    })
    expect(model.requirements[0]!.scenarios[0]!.residualBodyMarkdown).toBe('- THEN it renders')
  })

  it('preserves scenario body markdown that is not represented by step metadata', () => {
    const bodyMarkdown = [
      '- **GIVEN** a saved spec',
      '- **WHEN** the reader opens the spec page',
      '',
      'Some extra scenario paragraph stays visible.',
      '',
      '- A normal markdown list stays visible too.',
    ].join('\n')

    expect(
      createScenarioResidualBodyMarkdown(bodyMarkdown, [
        {
          keyword: 'GIVEN',
          contentMarkdown: 'a saved spec',
          rawText: '- **GIVEN** a saved spec',
        },
        {
          keyword: 'WHEN',
          contentMarkdown: 'the reader opens the spec page',
          rawText: '- **WHEN** the reader opens the spec page',
        },
      ])
    ).toBe(
      'Some extra scenario paragraph stays visible.\n\n- A normal markdown list stays visible too.'
    )
  })

  it('extracts non-standard top-level markdown sections around requirements', () => {
    const markdown = `# Spec

## Purpose
Purpose copy.

## Context
Context copy.

## Requirements
Intro copy.

### Requirement: One
Requirement copy.

## Notes
Notes copy.
`

    expect(extractExtraMarkdownSections(markdown)).toEqual({
      beforeRequirements: '## Context\nContext copy.',
      requirementsIntro: 'Intro copy.',
      afterRequirements: '## Notes\nNotes copy.',
    })
  })

  it('uses annotated facts instead of splitting fenced-code headings', () => {
    const markdown = `# Spec

## Purpose
Purpose copy.

## Context
\`\`\`md
## Requirements
### Requirement: Fake
\`\`\`

## Requirements
Intro copy.

### Requirement: One
Requirement copy.
`

    const document = projectOpenSpecMarkdown(markdown, { specId: 'spec' })

    expect(extractExtraMarkdownSectionsFromAnnotatedDocument(document)).toEqual({
      beforeRequirements: [
        '## Context',
        '```md',
        '## Requirements',
        '### Requirement: Fake',
        '```',
      ].join('\n'),
      requirementsIntro: 'Intro copy.',
      afterRequirements: '',
    })
  })

  it('uses loose annotations for AI-mutated capability sections', () => {
    const markdown = `# Spec

## Objective
Objective copy.

## Capabilities
Intro copy.

### Capability: One
The system SHOULD parse this.
`

    const document = projectOpenSpecMarkdown(markdown, { specId: 'spec' })

    expect(extractExtraMarkdownSectionsFromAnnotatedDocument(document)).toEqual({
      beforeRequirements: '',
      requirementsIntro: 'Intro copy.',
      afterRequirements: '',
    })
  })
})
