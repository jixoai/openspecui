import type { Spec } from '@openspecui/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SpecMarkdownDocument, describeOpenSpecHeading } from './spec-markdown-document'

const richSpecMarkdown = `# Rich Requirement Body

## Purpose
Expose Markdown fidelity bugs.

## Requirements
Intro copy stays visible.

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
  afterEach(() => {
    cleanup()
  })

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
    expect(requirement.getAttribute('data-openspec-label')).toBe('REQ-02')
    expect(requirement.id).toBe('requirement-body-list-before-scenario')

    const scenario = screen.getByRole('heading', { name: 'Scenario: Explicit scenario only' })
    expect(scenario.getAttribute('data-openspec-kind')).toBe('scenario')
    expect(scenario.getAttribute('data-openspec-title')).toBe('Explicit scenario only')
    expect(scenario.getAttribute('data-openspec-label')).toBe('Scenario')
    expect(scenario.id).toBe('scenario-explicit-scenario-only')

    expect(screen.queryByText(/Scenarios \(2\)/)).toBeNull()
  })

  it('renders OpenSpec keyword annotations as inline visual markers', () => {
    const { container } = render(
      <SpecMarkdownDocument
        markdown={`${richSpecMarkdown}

\`SHALL\`

\`\`\`md
WHEN
\`\`\`
`}
      />
    )

    const shall = container.querySelector('[data-openspec-keyword="SHALL"]')
    const when = container.querySelector('[data-openspec-keyword="WHEN"]')
    const then = container.querySelector('[data-openspec-keyword="THEN"]')

    expect(shall).toBeTruthy()
    expect(when).toBeTruthy()
    expect(then).toBeTruthy()
    expect(shall?.className).toContain('openspec-inline-keyword')
    expect(shall?.getAttribute('data-openspec-keyword-role')).toBe('requirement-modal')
    expect(when?.className).toContain('openspec-inline-keyword')
    expect(when?.getAttribute('data-openspec-keyword-role')).toBe('scenario-step')
    expect(then?.className).toContain('openspec-inline-keyword')
    expect(container.querySelectorAll('code .openspec-inline-keyword')).toHaveLength(0)
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
    expect(describeOpenSpecHeading(3, 'Capability: Sign in')).toMatchObject({
      kind: 'requirement',
      id: 'requirement-sign-in',
      tocLabel: 'Sign in',
    })
    expect(describeOpenSpecHeading(4, 'Example: Valid password')).toMatchObject({
      kind: 'scenario',
      id: 'scenario-valid-password',
      tocLabel: 'Valid password',
    })
    expect(describeOpenSpecHeading(4, 'Notes')).toBeUndefined()
    expect(describeOpenSpecHeading(3, 'Plain authored heading')).toBeUndefined()
  })

  it('marks AI-mutated capability headings through core annotations in markdown-first mode', () => {
    const markdown = `# Spec

## Objective
Objective copy.

## Capabilities
### Capability: Sign in
The system SHOULD allow sign in.

#### Example: Valid password
- when the user submits valid credentials
- then the session starts

#### Notes
- Plain authored content.
`

    render(<SpecMarkdownDocument markdown={markdown} requirementCount={1} />)

    const requirement = screen.getByRole('heading', { name: 'Capability: Sign in' })
    const scenario = screen.getByRole('heading', { name: 'Example: Valid password' })
    const notes = screen
      .getAllByRole('heading', { name: 'Notes' })
      .find((heading) => heading.tagName === 'H4')

    expect(requirement.getAttribute('data-openspec-kind')).toBe('requirement')
    expect(requirement.getAttribute('data-openspec-title')).toBe('Sign in')
    expect(scenario.getAttribute('data-openspec-kind')).toBe('scenario')
    expect(scenario.getAttribute('data-openspec-title')).toBe('Valid password')
    expect(notes?.getAttribute('data-openspec-kind')).toBeNull()
  })

  it('renders parsed specs through raw markdown while using spec data only as count fallback', () => {
    const spec: Spec = {
      id: 'rich-requirement-body',
      name: 'Rich Requirement Body Specification',
      overview: 'Expose Markdown fidelity bugs.\n\n**Important:** keep purpose markdown.',
      requirements: [
        {
          id: 'req-1',
          title: 'Multiline Markdown Body',
          bodyMarkdown:
            'The system SHALL preserve rich Markdown in requirement bodies.\n\n> Quote remains visible.',
          text: 'Multiline Markdown Body',
          scenarios: [
            {
              title: 'Normal scenario remains',
              bodyMarkdown:
                '- **WHEN** the spec detail page renders this requirement\n- **THEN** bold, quote, and code blocks render as Markdown\n\nSome extra scenario paragraph stays visible.',
              rawText:
                'Normal scenario remains\n- **WHEN** the spec detail page renders this requirement\n- **THEN** bold, quote, and code blocks render as Markdown\n\nSome extra scenario paragraph stays visible.',
              steps: [
                {
                  keyword: 'WHEN',
                  contentMarkdown: 'the spec detail page renders this requirement',
                  rawText: '- **WHEN** the spec detail page renders this requirement',
                },
                {
                  keyword: 'THEN',
                  contentMarkdown: 'bold, quote, and code blocks render as Markdown',
                  rawText: '- **THEN** bold, quote, and code blocks render as Markdown',
                },
              ],
            },
          ],
        },
      ],
    }

    const { container } = render(
      <SpecMarkdownDocument markdown={richSpecMarkdown} spec={spec} requirementCount={1} />
    )

    expect(container.querySelector('.spec-purpose-zone')).toBeNull()
    expect(container.querySelector('.spec-scenario-card')).toBeNull()
    expect(container.querySelector('div.spec-scenario-step')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Rich Requirement Body' })).toBeTruthy()
    expect(screen.getByText('Expose Markdown fidelity bugs.')).toBeTruthy()

    const requirement = screen.getByRole('heading', {
      name: 'Requirement: Multiline Markdown Body',
    })
    expect(requirement).toBeTruthy()
    expect(within(container).getByText('Intro copy stays visible.')).toBeTruthy()
    expect(screen.queryByText('REQ-01')).toBeNull()
    expect(requirement.getAttribute('data-openspec-kind')).toBe('requirement')
    expect(requirement.getAttribute('data-openspec-title')).toBe('Multiline Markdown Body')
    expect(requirement.getAttribute('data-openspec-label')).toBe('REQ-01')
    expect(container.querySelector('blockquote')?.textContent).toContain(
      'This quote should render as a quote block.'
    )

    const purposeCopy = screen.getByText('Expose Markdown fidelity bugs.')
    expect(purposeCopy.getAttribute('data-openspec-zone')).toBe('purpose')
    expect(purposeCopy.getAttribute('data-openspec-block-kind')).toBe('paragraph')

    const requirementsIntro = screen.getByText('Intro copy stays visible.')
    expect(requirementsIntro.getAttribute('data-openspec-zone')).toBe('requirements-intro')

    const requirementBody = Array.from(container.querySelectorAll('p')).find(
      (paragraph) =>
        paragraph.textContent === 'The system SHALL preserve rich Markdown in requirement bodies.'
    )
    expect(requirementBody).toBeTruthy()
    expect(requirementBody?.getAttribute('data-openspec-zone')).toBe('requirement-body')
    expect(requirementBody?.getAttribute('data-openspec-requirement-label')).toBe('REQ-01')

    const scenario = screen.getByRole('heading', { name: 'Scenario: Explicit scenario only' })
    expect(scenario.getAttribute('data-openspec-kind')).toBe('scenario')
    expect(scenario.getAttribute('data-openspec-label')).toBe('Scenario')

    const scenarioStepItems = container.querySelectorAll(
      'ul > li[data-openspec-kind="scenario-step"]'
    )
    expect(scenarioStepItems).toHaveLength(2)
    expect(getComputedStyle(scenarioStepItems[0] as HTMLElement).display).toBe('list-item')
    const scenarioStepList = scenarioStepItems[0]?.parentElement
    expect(scenarioStepList?.tagName).toBe('UL')
    expect(scenarioStepList?.getAttribute('data-openspec-zone')).toBe('scenario-body')
    expect(scenarioStepList?.getAttribute('data-openspec-requirement-label')).toBe('REQ-02')
    expect(scenarioStepList?.getAttribute('data-openspec-scenario-title')).toBe(
      'Explicit scenario only'
    )
    const whenKeyword = within(scenarioStepItems[0] as HTMLElement).getByText('WHEN')
    const thenKeyword = within(scenarioStepItems[1] as HTMLElement).getByText('THEN')
    expect(whenKeyword.className).toContain('openspec-inline-keyword')
    expect(whenKeyword.getAttribute('data-openspec-keyword')).toBe('WHEN')
    expect(whenKeyword.getAttribute('data-openspec-keyword-role')).toBe('scenario-step')
    expect(whenKeyword.closest('li')?.getAttribute('data-openspec-kind')).toBe('scenario-step')
    expect(whenKeyword.closest('div.spec-scenario-step')).toBeNull()
    expect(thenKeyword.className).toContain('openspec-inline-keyword')
    expect(thenKeyword.getAttribute('data-openspec-keyword')).toBe('THEN')
    expect(screen.getByText('a scenario heading appears')).toBeTruthy()
    expect(screen.getByText('only the following list belongs to the scenario')).toBeTruthy()

    const toc = document.querySelector('nav.toc-wide')
    expect(toc).toBeTruthy()
    const tocScope = within(toc as HTMLElement)
    expect(tocScope.getByRole('link', { name: 'Requirements', hidden: true })).toBeTruthy()
    expect(tocScope.queryByRole('link', { name: 'Requirements 1', hidden: true })).toBeNull()
  })

  it('marks scenario steps from rendered markdown even when backend spec lacks steps', () => {
    const staleSpec: Spec = {
      id: 'rich-requirement-body',
      name: 'Rich Requirement Body Specification',
      overview: 'Stale backend overview.',
      requirements: [
        {
          id: 'req-1',
          title: 'Body List Before Scenario',
          bodyMarkdown: 'Stale backend requirement body.',
          text: 'Body List Before Scenario',
          scenarios: [
            {
              title: 'Explicit scenario only',
              bodyMarkdown:
                '- **WHEN** a scenario heading appears\n- **THEN** only the following list belongs to the scenario',
              rawText:
                'Explicit scenario only\n- **WHEN** a scenario heading appears\n- **THEN** only the following list belongs to the scenario',
            },
          ],
        },
      ],
    }

    const { container } = render(
      <SpecMarkdownDocument markdown={richSpecMarkdown} spec={staleSpec} requirementCount={1} />
    )

    expect(container.querySelector('.spec-scenario-card')).toBeNull()
    expect(container.querySelector('div.spec-scenario-step')).toBeNull()

    const scenarioStepItems = container.querySelectorAll(
      'ul > li[data-openspec-kind="scenario-step"]'
    )
    expect(scenarioStepItems).toHaveLength(2)
    const whenKeyword = within(scenarioStepItems[0] as HTMLElement).getByText('WHEN')
    const thenKeyword = within(scenarioStepItems[1] as HTMLElement).getByText('THEN')

    expect(whenKeyword.className).toContain('openspec-inline-keyword')
    expect(whenKeyword.getAttribute('data-openspec-keyword')).toBe('WHEN')
    expect(whenKeyword.getAttribute('data-openspec-keyword-role')).toBe('scenario-step')
    expect(thenKeyword.getAttribute('data-openspec-keyword')).toBe('THEN')
  })

  it('keeps extra authored top-level sections visible in semantic reading mode', () => {
    const spec: Spec = {
      id: 'rich-requirement-body',
      name: 'Rich Requirement Body Specification',
      overview: 'Expose Markdown fidelity bugs.',
      requirements: [
        {
          id: 'req-1',
          title: 'Multiline Markdown Body',
          bodyMarkdown: 'The system SHALL preserve rich Markdown in requirement bodies.',
          text: 'Multiline Markdown Body',
          scenarios: [],
        },
      ],
    }

    const { container } = render(
      <SpecMarkdownDocument markdown={richSpecMarkdown} spec={spec} requirementCount={1} />
    )

    const documentScope = within(container)
    expect(documentScope.getByRole('heading', { name: 'Notes' })).toBeTruthy()
    expect(documentScope.getByRole('heading', { name: 'Plain authored heading' })).toBeTruthy()

    const toc = container.querySelector('nav.toc-wide')
    expect(toc).toBeTruthy()
    const tocScope = within(toc as HTMLElement)
    expect(tocScope.getByRole('link', { name: 'Notes', hidden: true })).toBeTruthy()
    expect(
      tocScope.getByRole('link', { name: 'Plain authored heading', hidden: true })
    ).toBeTruthy()
  })
})
