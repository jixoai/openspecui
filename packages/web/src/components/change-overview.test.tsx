import type { Change } from '@openspecui/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangeOverview } from './change-overview'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

const deltaSpecMarkdown = `# Delta for Auth

## ADDED Requirements

### Requirement: Sign in

The system SHALL let users sign in.

#### Scenario: Valid credentials

- **WHEN** valid credentials are submitted
- **THEN** a session is created
`

const change: Change = {
  id: 'add-auth',
  name: 'Add Auth',
  why: 'Users need sessions.',
  whatChanges: 'Add sign-in behavior.',
  deltas: [
    {
      spec: 'auth',
      operation: 'ADDED',
      description: 'Add auth requirements.',
    },
  ],
  tasks: [],
  progress: { total: 0, completed: 0 },
  deltaSpecs: [{ specId: 'auth', content: deltaSpecMarkdown }],
}

describe('ChangeOverview', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders delta specs through the path-driven OpenSpec Markdown plugin', () => {
    const { container } = render(<ChangeOverview change={change} />)

    const specDocument = container.querySelector('.markdown-content.openspec-markdown-document')
    expect(specDocument).toBeTruthy()

    const requirement = within(specDocument as HTMLElement).getByRole('heading', {
      name: 'Requirement: Sign in',
    })
    expect(requirement).toHaveAttribute('data-openspec-kind', 'requirement')
    expect(requirement).toHaveAttribute('data-openspec-title', 'Sign in')
    expect(requirement).toHaveAttribute('data-openspec-label', 'REQ-01')

    expect(screen.getByRole('heading', { name: 'Scenario: Valid credentials' })).toHaveAttribute(
      'data-openspec-kind',
      'scenario'
    )
  })
})
