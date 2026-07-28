/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Prove Change path and action context remain CLI-authored.
 * 2. Prove Reference diagnostics remain neutral evidence.
 * 3. Prove static mode does not fabricate backend provenance.
 * 4. Keep checked live Status fixtures complete with their CLI evidence envelope.
 *
 * Original request (2026-07-15): "保持客观中立很重要。"
 * Original request (2026-07-23): "OPSX Status 不应等待完整 Kernel warmup，且必须保留 CLI evidence。"
 */
import type { ChangeStatus } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChangeContextEvidence } from './change-context-evidence'

function cliStatus(): ChangeStatus {
  return {
    changeName: 'add-auth',
    schemaName: 'spec-driven',
    isComplete: false,
    applyRequires: ['tasks'],
    artifacts: [{ id: 'tasks', outputPath: 'tasks.md', status: 'ready' }],
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

describe('ChangeContextEvidence', () => {
  afterEach(() => cleanup())

  it('renders exact CLI paths, action context, and direct Reference evidence', () => {
    const { container } = render(
      <ChangeContextEvidence
        status={cliStatus()}
        references={[
          {
            store_id: 'design-system',
            status: [{ severity: 'warning', code: 'reference_unresolved', message: 'Missing.' }],
          },
        ]}
      />
    )

    expect(screen.getByText('/planning/openspec/changes/add-auth')).toBeTruthy()
    expect(screen.getByText('store · Store platform')).toBeTruthy()
    expect(screen.getByText('repo-local · repo')).toBeTruthy()
    expect(screen.getAllByText('design-system')).toHaveLength(2)
    expect(screen.getByText('0 error · 1 warning · 1 total')).toBeTruthy()

    fireEvent.click(screen.getByText('Artifact paths and action context'))
    expect(container.textContent).toContain('/planning/openspec/changes/add-auth/tasks.md')
    expect(container.textContent).toContain('Repo-local edits only.')
    expect(container.textContent).not.toMatch(/healthy|all references|unreferenced/i)
  })

  it('keeps static provenance explicitly unavailable', () => {
    render(
      <ChangeContextEvidence
        status={{ ...cliStatus(), provenance: { kind: 'static' } }}
        references={[]}
      />
    )

    expect(screen.getByText('Unavailable in this static snapshot.')).toBeTruthy()
    expect(screen.getByText('No reference currently observed.')).toBeTruthy()
    expect(screen.queryByText('Artifact paths and action context')).toBeNull()
  })
})
