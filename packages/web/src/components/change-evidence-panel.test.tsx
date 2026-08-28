/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Prove the summary/paths and CLI-result sections carry the complete layered evidence
 *    surface the Evidence workspace addresses as list rows.
 * 2. Keep nested raw CLI payload on-demand and bounded.
 * 3. Preserve explicit static provenance unavailability.
 *
 * Original request (2026-08-03): use a tab as the carrier between necessary and complete Change evidence.
 * Original request (2026-08-28): "使用移动端的 list-detail 思维……分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
 */
import type { ChangeStatus, CliReferenceIndexEntry } from '@openspecui/core'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChangeReferenceEvidence } from './change-context-summary'
import { ChangeCliResultSection, ChangeSummaryPathsSection } from './change-evidence-panel'

function status(): ChangeStatus {
  return {
    changeName: 'add-auth',
    schemaName: 'spec-driven',
    isPlanningComplete: false,
    applyRequires: ['tasks'],
    artifacts: [{ id: 'tasks', outputPath: 'tasks.md', status: 'ready', requires: [] }],
    provenance: {
      kind: 'cli',
      planningHome: {
        kind: 'repo',
        root: '/planning',
        changesDir: '/planning/openspec/changes',
        defaultSchema: 'spec-driven',
      },
      changeRoot: '/planning/openspec/changes/add-auth',
      artifactPaths: {
        tasks: {
          outputPath: 'tasks.md',
          resolvedOutputPath: '/planning/openspec/changes/add-auth/tasks.md',
          existingOutputPaths: ['/planning/openspec/changes/add-auth/tasks.md'],
        },
      },
      nextSteps: ['Apply the change.'],
      actionContext: {
        mode: 'repo-local',
        sourceOfTruth: 'repo',
        planningArtifacts: ['tasks'],
        linkedContext: [{ name: 'design-system' }],
        allowedEditRoots: ['/planning'],
        requiresAffectedAreaSelection: false,
        constraints: ['Repo-local edits only.'],
      },
      root: { path: '/planning', source: 'store', store_id: 'platform' },
      evidence: {
        command: 'status',
        success: true,
        stdout: '{"changeName":"add-auth"}',
        stderr: '',
        exitCode: 0,
        payload: { changeName: 'add-auth' },
        diagnostics: [],
        selector: { store: 'platform' },
      },
    },
  }
}

const references: CliReferenceIndexEntry[] = [
  {
    store_id: 'design-system',
    status: [{ severity: 'warning', code: 'reference_unresolved', message: 'Missing.' }],
  },
]

describe('Change evidence workspace sections', () => {
  afterEach(() => cleanup())

  it('renders readable facts with the layered artifact and reference disclosures first', () => {
    const referenceEvidence: ChangeReferenceEvidence = { state: 'current', references }

    render(<ChangeSummaryPathsSection status={status()} referenceEvidence={referenceEvidence} />)

    const section = screen.getByRole('region', { name: 'Summary & paths' })
    expect(section.getAttribute('data-evidence-section')).toBe('summary-paths')
    expect(screen.getByText('/planning/openspec/changes/add-auth')).toBeVisible()
    expect(screen.getByRole('button', { name: /Artifact outputs/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^References/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /CLI result/ })).toBeNull()
  })

  it('renders the CLI result with the raw payload disclosure as the last addressed section', () => {
    render(<ChangeCliResultSection status={status()} />)

    const section = screen.getByRole('region', { name: 'CLI result' })
    expect(section.getAttribute('data-evidence-section')).toBe('cli-result')
    // The CLI facts render directly — only the raw payload stays on-demand and bounded.
    expect(within(section).getByText('status')).toBeVisible()
    expect(screen.getByRole('button', { name: /Raw CLI payload/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Raw CLI payload/ }))
    expect(screen.getByText((_, element) => element?.tagName === 'PRE')).toBeVisible()
  })

  it('states that static snapshots do not publish live evidence and omits the CLI section', () => {
    const referenceEvidence: ChangeReferenceEvidence = { state: 'unavailable', reason: 'static' }

    const { container } = render(
      <>
        <ChangeSummaryPathsSection
          status={{ ...status(), provenance: { kind: 'static' } }}
          referenceEvidence={referenceEvidence}
        />
        <ChangeCliResultSection status={{ ...status(), provenance: { kind: 'static' } }} />
      </>
    )

    expect(screen.getByRole('region', { name: 'Summary & paths' })).toHaveTextContent(
      'CLI Change context and Reference evidence are unavailable in this static snapshot.'
    )
    fireEvent.click(screen.getByRole('button', { name: /Artifact outputs/ }))
    expect(screen.getByText('tasks.md')).toBeVisible()
    expect(container.querySelector('[data-evidence-section="cli-result"]')).toBeNull()
  })
})
