/**
 * Orthogonal intents (created 2026-08-03 Asia/Shanghai):
 * 1. Prove Schema, artifact progress, Root, and References share the subtitle badge vocabulary.
 * 2. Prove unavailable and retained Reference authority are not collapsed into zero.
 * 3. Keep direct Reference failures visible outside verbose evidence.
 *
 * Original request (2026-08-03): keep the Change Detail default surface compact while preserving necessary facts.
 * Owner correction (2026-08-03): unify Schema, progress, Root, and Reference Tooltips in the subtitle.
 */
import type { ChangeStatus, CliReferenceIndexEntry } from '@openspecui/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ChangeContextSummary,
  type ChangeReferenceEvidence,
  ChangeReferenceFailureNotice,
} from './change-context-summary'

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
        linkedContext: [],
        allowedEditRoots: ['/planning'],
        requiresAffectedAreaSelection: false,
        constraints: [],
      },
      root: { path: '/planning', source: 'store', store_id: 'platform' },
      evidence: {
        command: 'status',
        success: true,
        stdout: '{}',
        stderr: '',
        exitCode: 0,
        payload: {},
        diagnostics: [],
        selector: { store: 'platform' },
      },
    },
  }
}

const references: CliReferenceIndexEntry[] = [
  {
    store_id: 'design-system',
    status: [{ severity: 'error', code: 'missing', message: 'Missing Store.' }],
  },
]

describe('ChangeContextSummary', () => {
  afterEach(() => cleanup())

  it('keeps unavailable References distinct from an observed empty list', () => {
    const referenceEvidence: ChangeReferenceEvidence = {
      state: 'unavailable',
      reason: 'root-context',
    }

    render(
      <>
        <ChangeContextSummary status={status()} referenceEvidence={referenceEvidence} />
        <ChangeReferenceFailureNotice referenceEvidence={referenceEvidence} />
      </>
    )

    expect(screen.getByRole('note', { name: 'Workflow schema spec-driven' })).toHaveTextContent(
      'Schema: spec-driven'
    )
    expect(screen.getByRole('note', { name: 'Artifact progress 0 of 1' })).toHaveTextContent(
      '0/1 artifacts'
    )
    expect(screen.getByRole('note', { name: /Change Root source store/ })).toHaveTextContent(
      'Store platform'
    )
    expect(screen.getByText('References unavailable')).toBeTruthy()
    expect(screen.queryByText('References 0')).toBeNull()
    expect(screen.queryByText('Change context')).toBeNull()
  })

  it('marks retained References and keeps their failures direct', () => {
    const referenceEvidence: ChangeReferenceEvidence = { state: 'retained', references }

    render(
      <>
        <ChangeContextSummary status={status()} referenceEvidence={referenceEvidence} />
        <ChangeReferenceFailureNotice referenceEvidence={referenceEvidence} />
      </>
    )

    expect(screen.getByText('Retained References 1')).toBeTruthy()
    expect(screen.getByRole('alert')).toHaveTextContent('Reference errors: design-system (1)')
    expect(screen.getByText('Reference errors: design-system (1)')).toBeVisible()
  })

  it('renders static provenance as an explicit compact fact', () => {
    const referenceEvidence: ChangeReferenceEvidence = { state: 'unavailable', reason: 'static' }

    render(
      <ChangeContextSummary
        status={{ ...status(), provenance: { kind: 'static' } }}
        referenceEvidence={referenceEvidence}
      />
    )

    expect(screen.getByText('Static snapshot')).toBeTruthy()
    expect(screen.getByText('References unavailable')).toBeTruthy()
  })
})
