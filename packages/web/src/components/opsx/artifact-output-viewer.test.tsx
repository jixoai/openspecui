import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArtifactOutputViewer, ContentFallbackViewer } from './artifact-output-viewer'

const artifactOutputMock = vi.hoisted(() => vi.fn())
const globArtifactFilesMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-opsx', () => ({
  useOpsxArtifactOutputSubscription: artifactOutputMock,
  useOpsxGlobArtifactFilesSubscription: globArtifactFilesMock,
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => ({
    data: {
      translation: {
        enabled: false,
        targetLanguage: 'zh',
        displayMode: 'direct',
        cacheEnabled: false,
      },
    },
  }),
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
    const content = document.querySelector('.toc-page-content')
    expect(content).toBeTruthy()
    expect(within(content as HTMLElement).getByText('tasks')).toBeTruthy()
    expect(within(content as HTMLElement).getByText('tasks.md')).toBeTruthy()
    expect(artifactOutputMock).toHaveBeenCalledWith('add-auth', 'tasks.md')
  })

  it('renders archived artifact files without subscribing to live artifact output', () => {
    render(
      <ArtifactOutputViewer
        changeId="2026-05-17-add-auth"
        artifact={{
          id: 'summary',
          outputPath: 'reports/summary.md',
          files: [
            {
              path: 'reports/summary.md',
              type: 'file',
              content: '# Archived Summary\n\nThe archived artifact is already materialized.',
            },
          ],
        }}
      />
    )

    expect(screen.getByRole('heading', { name: 'Archived Summary' })).toBeTruthy()
    expect(screen.getByText(/already materialized/)).toBeTruthy()
    expect(screen.getByText('summary')).toBeTruthy()
    expect(screen.getByText('reports/summary.md')).toBeTruthy()
    expect(screen.getByText('1 file')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Configure translation' })).toBeTruthy()
    const content = document.querySelector('.toc-page-content')
    expect(content).toBeTruthy()
    expect(
      within(content as HTMLElement).getByRole('heading', { name: 'Archived Summary' })
    ).toBeTruthy()
    expect(artifactOutputMock).not.toHaveBeenCalled()
    expect(globArtifactFilesMock).not.toHaveBeenCalled()
  })

  it('renders content fallback through the same root document viewer contract', () => {
    render(
      <ContentFallbackViewer
        fallback={{
          id: 'content',
          label: 'Content',
          outputPath: 'openspec/changes/archive/**/*.md',
          relativePath: 'archive/2026-05-17-add-auth',
          files: [
            {
              path: 'notes/decision.md',
              type: 'file',
              content: '# Decision\n\nKeep the shared shell.',
            },
          ],
          emptyMessage: 'No Markdown files found.',
        }}
      />
    )

    const content = document.querySelector('.toc-page-content')
    expect(content).toBeTruthy()
    expect(within(content as HTMLElement).getByText('content')).toBeTruthy()
    expect(
      within(content as HTMLElement).getByText('archive/2026-05-17-add-auth')
    ).toBeTruthy()
    expect(within(content as HTMLElement).getByRole('heading', { name: 'Decision' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Configure translation' })).toBeTruthy()
    expect(document.querySelectorAll('aside.toc-root')).toHaveLength(1)
    expect(document.querySelectorAll('.viewer-scroll')).toHaveLength(1)
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
    expect(within(content as HTMLElement).getByText('specs')).toBeTruthy()
    expect(within(content as HTMLElement).getByText('specs/**/*.md')).toBeTruthy()
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
