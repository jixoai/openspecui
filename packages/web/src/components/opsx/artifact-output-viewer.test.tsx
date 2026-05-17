import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArtifactOutputViewer } from './artifact-output-viewer'

const artifactOutputMock = vi.hoisted(() => vi.fn())
const globArtifactFilesMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-opsx', () => ({
  useOpsxArtifactOutputSubscription: artifactOutputMock,
  useOpsxGlobArtifactFilesSubscription: globArtifactFilesMock,
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => ({ data: { translation: { enabled: false } } }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

describe('ArtifactOutputViewer', () => {
  beforeEach(() => {
    artifactOutputMock.mockReset()
    globArtifactFilesMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders processed single artifact Markdown from the server reading path', () => {
    artifactOutputMock.mockReturnValue({
      data: '# Processed Tasks\n\n- [ ] hook applied',
      isLoading: false,
    })

    render(
      <ArtifactOutputViewer
        changeId="add-auth"
        artifact={{ id: 'tasks', outputPath: 'tasks.md', status: 'done' }}
      />
    )

    expect(screen.getByRole('heading', { name: 'Processed Tasks' })).toBeTruthy()
    expect(screen.getByText('hook applied')).toBeTruthy()
    expect(artifactOutputMock).toHaveBeenCalledWith('add-auth', 'tasks.md')
  })

  it('renders change delta spec glob artifacts with the spec document renderer', () => {
    globArtifactFilesMock.mockReturnValue({
      data: [
        {
          path: 'specs/auth/spec.md',
          type: 'file',
          content: `# Delta for Auth

## ADDED Requirements

### Requirement: Sign in

The system SHALL let users sign in.

#### Scenario: Valid credentials

- **WHEN** valid credentials are submitted
- **THEN** a session is created
`,
        },
      ],
      isLoading: false,
    })

    render(
      <ArtifactOutputViewer
        changeId="add-auth"
        artifact={{ id: 'specs', outputPath: 'specs/**/*.md', status: 'done' }}
      />
    )

    const content = document.querySelector('.toc-page-content')
    expect(content).toBeTruthy()
    expect(within(content as HTMLElement).getByText('specs/auth/spec.md')).toBeTruthy()

    const requirement = within(content as HTMLElement).getByRole('heading', {
      name: 'Requirement: Sign in',
    })
    expect(requirement.getAttribute('data-openspec-kind')).toBe('requirement')
    expect(requirement.getAttribute('data-openspec-title')).toBe('Sign in')

    expect(
      within(content as HTMLElement).getByRole('heading', {
        name: 'Scenario: Valid credentials',
      })
    ).toHaveAttribute('data-openspec-kind', 'scenario')
    expect(
      within(document.querySelector('aside.toc-root') as HTMLElement).getByRole('button', {
        name: 'Configure translation',
      })
    ).toBeTruthy()
    expect(document.querySelectorAll('aside.toc-root')).toHaveLength(1)
    expect(document.querySelectorAll('.viewer-scroll')).toHaveLength(1)
    expect(globArtifactFilesMock).toHaveBeenCalledWith('add-auth', 'specs/**/*.md')
  })

  it('keeps non-spec glob markdown in the same root viewer without spec semantics', () => {
    globArtifactFilesMock.mockReturnValue({
      data: [
        {
          path: 'tasks.md',
          type: 'file',
          content: `# Tasks

### Requirement: Text that should stay ordinary
`,
        },
      ],
      isLoading: false,
    })

    render(
      <ArtifactOutputViewer
        changeId="add-auth"
        artifact={{ id: 'tasks', outputPath: '*.md', status: 'done' }}
      />
    )

    const content = document.querySelector('.toc-page-content')
    expect(content).toBeTruthy()
    expect(within(content as HTMLElement).getByText('tasks.md')).toBeTruthy()
    const requirementLikeHeading = within(content as HTMLElement).getByRole('heading', {
      name: 'Requirement: Text that should stay ordinary',
    })
    expect(requirementLikeHeading.getAttribute('data-openspec-kind')).toBeNull()
    expect(document.querySelectorAll('aside.toc-root')).toHaveLength(1)
  })
})
