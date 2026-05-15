import { describe, expect, it } from 'vitest'
import { parseMarkdownFacts, toMarkdownFactKind } from './markdown-facts.js'

describe('parseMarkdownFacts', () => {
  it('extracts heading facts with source ranges and raw markdown slices', () => {
    const document = parseMarkdownFacts(`# Reader Spec

## Requirements
Intro copy.
`)

    const headings = document.facts.filter((fact) => fact.kind === 'heading')

    expect(headings).toHaveLength(2)
    expect(headings[0]).toMatchObject({
      depth: 1,
      text: 'Reader Spec',
    })
    expect(headings[0]!.range).toMatchObject({
      rawMarkdown: '# Reader Spec',
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 14, offset: 13 },
    })
    expect(headings[1]).toMatchObject({
      depth: 2,
      text: 'Requirements',
    })
    expect(headings[1]!.range?.rawMarkdown).toBe('## Requirements')
  })

  it('represents GFM tables as objective table, row, and cell facts', () => {
    const document = parseMarkdownFacts(`| Key | Value |
| --- | --- |
| Owner | Platform |
`)

    const table = document.facts.find((fact) => fact.kind === 'table')
    const rows = document.facts.filter((fact) => fact.kind === 'tableRow')
    const cells = document.facts.filter((fact) => fact.kind === 'tableCell')

    expect(table).toBeTruthy()
    expect(table!.text).toContain('Owner')
    expect(table!.range?.rawMarkdown).toContain('| Key | Value |')
    expect(rows).toHaveLength(2)
    expect(cells.map((cell) => cell.text)).toEqual(['Key', 'Value', 'Owner', 'Platform'])
  })

  it('preserves list item text and task state for scenario-like markdown', () => {
    const document = parseMarkdownFacts(`- [x] **WHEN** the reader opens the spec
- **THEN** it renders
`)

    const listItems = document.facts.filter((fact) => fact.kind === 'listItem')

    expect(listItems).toHaveLength(2)
    expect(listItems[0]).toMatchObject({
      checked: true,
      text: 'WHEN the reader opens the spec',
    })
    expect(listItems[0]!.range?.rawMarkdown).toBe('- [x] **WHEN** the reader opens the spec')
    expect(listItems[1]).toMatchObject({
      text: 'THEN it renders',
    })
    expect(listItems[1]!.checked).toBeUndefined()
  })

  it('keeps fenced-code fake headings as code content instead of heading facts', () => {
    const document = parseMarkdownFacts(`\`\`\`md
## Requirements
### Requirement: Fake
\`\`\`

# Real Heading
`)

    const headings = document.facts.filter((fact) => fact.kind === 'heading')
    const code = document.facts.find((fact) => fact.kind === 'code')

    expect(headings.map((heading) => heading.text)).toEqual(['Real Heading'])
    expect(code).toMatchObject({
      language: 'md',
      value: '## Requirements\n### Requirement: Fake',
    })
    expect(code!.range?.rawMarkdown).toContain('### Requirement: Fake')
  })

  it('maps unrecognized node types to unknown facts without hiding their mdast type', () => {
    expect(toMarkdownFactKind('futureDirective')).toBe('unknown')
  })
})
