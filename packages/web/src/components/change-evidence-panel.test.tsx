/**
 * Orthogonal intents (created 2026-08-03 Asia/Shanghai):
 * 1. Prove the complete Change evidence hierarchy is available through the Evidence panel.
 * 2. Keep nested raw CLI payload on-demand and bounded.
 * 3. Preserve explicit static provenance unavailability.
 *
 * Original request (2026-08-03): use a tab as the carrier between necessary and complete Change evidence.
 */
import type { ChangeStatus, CliReferenceIndexEntry } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChangeReferenceEvidence } from './change-context-summary'
import { ChangeEvidencePanel } from './change-evidence-panel'

function status(): ChangeStatus {
  return {
    changeName: 'add-auth',
    schemaName: 'spec-driven',
    isComplete: false,
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

describe('ChangeEvidencePanel', () => {
  afterEach(() => cleanup())

  it('renders readable facts and the full layered evidence surface', () => {
    const referenceEvidence: ChangeReferenceEvidence = { state: 'current', references }

    render(<ChangeEvidencePanel status={status()} referenceEvidence={referenceEvidence} />)

    const panel = screen.getByRole('region', { name: 'Change Evidence' })
    expect(panel.className).toContain('overflow-y-auto')
    expect(panel.className).toContain('overflow-x-hidden')
    expect(screen.getByText('/planning/openspec/changes/add-auth')).toBeVisible()
    expect(screen.getByRole('button', { name: /Artifact outputs/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^References/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /CLI result/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Raw CLI payload/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /CLI result/ }))
    fireEvent.click(screen.getByRole('button', { name: /Raw CLI payload/ }))
    expect(screen.getByText((_, element) => element?.tagName === 'PRE')).toBeVisible()
  })

  it('states that static snapshots do not publish live evidence', () => {
    const referenceEvidence: ChangeReferenceEvidence = { state: 'unavailable', reason: 'static' }

    render(
      <ChangeEvidencePanel
        status={{ ...status(), provenance: { kind: 'static' } }}
        referenceEvidence={referenceEvidence}
      />
    )

    expect(screen.getByRole('region', { name: 'Change Evidence' })).toHaveTextContent(
      'CLI Change context and Reference evidence are unavailable in this static snapshot.'
    )
    fireEvent.click(screen.getByRole('button', { name: /Artifact outputs/ }))
    expect(screen.getByText('tasks.md')).toBeVisible()
  })
})
