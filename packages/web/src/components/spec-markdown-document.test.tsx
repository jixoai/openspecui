import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SpecMarkdownDocument, describeOpenSpecHeading } from './spec-markdown-document'

const richSpecMarkdown = `# Rich Requirement Body

## Purpose
Expose Markdown fidelity bugs.

## Requirements
### Requirement: Multiline Markdown Body
The system SHALL preserve rich Markdown in requirement bodies.

**Important:** this bold marker should render as bold text.

> This quote should render as a quote block.

### Requirement: Body List Before Scenario
The system SHALL keep lists before scenario headings in the requirement body.

- **Owner**: Platform
- **Priority**: High

#### Scenario: Explicit scenario only
- WHEN a scenario heading appears
- THEN only the following list belongs to the scenario

## Notes
### Plain authored heading
Normal markdown headings should remain visible and navigable.
`

describe('SpecMarkdownDocument', () => {
  it('renders processed spec markdown as markdown while marking OpenSpec structures', () => {
    const { container } = render(<SpecMarkdownDocument markdown={richSpecMarkdown} />)

    expect(screen.getByRole('heading', { name: 'Rich Requirement Body' })).toBeTruthy()

    const strong = screen.getByText('Important:')
    expect(strong.tagName).toBe('STRONG')

    const blockquote = container.querySelector('blockquote')
    expect(blockquote?.textContent).toContain('This quote should render as a quote block.')

    const owner = screen.getByText('Owner')
    expect(owner.tagName).toBe('STRONG')
    expect(owner.closest('[data-openspec-kind="scenario"]')).toBeNull()

    const requirement = screen.getByRole('heading', {
      name: 'Requirement: Body List Before Scenario',
    })
    expect(requirement.getAttribute('data-openspec-kind')).toBe('requirement')
    expect(requirement.getAttribute('data-openspec-title')).toBe('Body List Before Scenario')
    expect(requirement.id).toBe('requirement-body-list-before-scenario')

    const scenario = screen.getByRole('heading', { name: 'Scenario: Explicit scenario only' })
    expect(scenario.getAttribute('data-openspec-kind')).toBe('scenario')
    expect(scenario.getAttribute('data-openspec-title')).toBe('Explicit scenario only')
    expect(scenario.id).toBe('scenario-explicit-scenario-only')

    expect(screen.queryByText(/Scenarios \(2\)/)).toBeNull()
  })

  it('keeps ToC labels and heading ids aligned for OpenSpec structures and normal headings', () => {
    render(<SpecMarkdownDocument markdown={richSpecMarkdown} requirementCount={2} />)

    const toc = document.querySelector('nav.toc-wide')
    expect(toc).toBeTruthy()
    const tocScope = within(toc as HTMLElement)

    const labels = [
      'Rich Requirement Body',
      'Purpose',
      'Requirements',
      'Multiline Markdown Body',
      'Body List Before Scenario',
      'Explicit scenario only',
      'Notes',
      'Plain authored heading',
    ]

    for (const label of labels) {
      const link = tocScope.getByRole('link', { name: label, hidden: true })
      const href = link.getAttribute('href')
      expect(href).toBeTruthy()
      expect(document.getElementById(href!.slice(1))).toBeTruthy()
    }

    const requirementsHeading = screen.getByRole('heading', {
      name: 'Requirements 2',
    })
    expect(requirementsHeading.getAttribute('data-openspec-kind')).toBe('section')
    expect(requirementsHeading.className).toContain('openspec-heading-with-chip')
    expect(within(requirementsHeading).getByLabelText('2')).toBeTruthy()
    expect(tocScope.queryByRole('link', { name: 'Requirements 2', hidden: true })).toBeNull()
  })

  it('classifies only OpenSpec requirement and scenario headings as semantic structures', () => {
    expect(describeOpenSpecHeading(3, 'Requirement: Save data')).toMatchObject({
      kind: 'requirement',
      id: 'requirement-save-data',
      tocLabel: 'Save data',
    })
    expect(describeOpenSpecHeading(4, 'Scenario: Save success')).toMatchObject({
      kind: 'scenario',
      id: 'scenario-save-success',
      tocLabel: 'Save success',
    })
    expect(describeOpenSpecHeading(4, 'Notes')).toBeUndefined()
    expect(describeOpenSpecHeading(3, 'Plain authored heading')).toBeUndefined()
  })
})
