/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Prove Change path, action context, and raw evidence remain CLI-authored on demand.
 * 2. Prove Reference summaries stay neutral while Reference errors remain direct.
 * 3. Prove static mode does not fabricate backend provenance.
 * 4. Keep checked OpenSpec 1.7 Status fixtures complete with dependency and CLI evidence.
 *
 * Original request (2026-07-15): "保持客观中立很重要。"
 * Original request (2026-07-23): "OPSX Status 不应等待完整 Kernel warmup，且必须保留 CLI evidence。"
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.
 * Owner correction (2026-07-29): Change evidence uses readable, artifact, Reference, CLI-result, and raw-payload layers without page overflow.
 * Original request (2026-08-01): OpenSpecUI 7 requires exact artifact dependency evidence.
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

describe('ChangeContextEvidence', () => {
  afterEach(() => cleanup())

  it('layers readable facts, artifacts, References, CLI result, and raw payload', () => {
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

    expect(screen.getByText('Store platform')).toBeTruthy()
    expect(screen.getByText('References 1')).toBeTruthy()
    expect(screen.getByText('/planning/openspec/changes/add-auth')).not.toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Paths and CLI evidence/ }))
    expect(screen.getByText('/planning/openspec/changes/add-auth')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Artifact outputs/ }))
    expect(container.textContent).toContain('/planning/openspec/changes/add-auth/tasks.md')
    expect(container.textContent).toContain('Repo-local edits only.')
    expect(
      screen.getByText(/tasks\.md -> \/planning\/openspec\/changes\/add-auth\/tasks\.md/)
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /^References/ }))
    expect(container.textContent).toContain('warning · reference_unresolved · Missing.')
    expect(screen.getByText('warning · reference_unresolved · Missing.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /CLI result/ }))
    expect(screen.getByText('status')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Raw CLI payload/ }))
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'PRE' &&
          element.textContent?.includes('\\"changeName\\":\\"add-auth\\"') === true
      )
    ).toBeVisible()
    expect(container.firstElementChild?.classList.contains('@container')).toBe(true)
    expect(container.textContent).not.toMatch(/healthy|all references|unreferenced/i)
  })

  it('keeps Reference errors outside the collapsed evidence region', () => {
    render(
      <ChangeContextEvidence
        status={cliStatus()}
        references={[
          {
            store_id: 'design-system',
            status: [{ severity: 'error', code: 'missing', message: 'Missing Store.' }],
          },
        ]}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Reference errors: design-system (1)')
    expect(screen.getByText(/Missing Store/)).not.toBeVisible()
  })

  it('keeps static provenance explicitly available through compact status', async () => {
    render(
      <ChangeContextEvidence
        status={{ ...cliStatus(), provenance: { kind: 'static' } }}
        references={[]}
      />
    )

    const badge = screen.getByRole('note', {
      name: 'Static Change context has no live backend provenance',
    })
    expect(badge.textContent).toBe('Static snapshot')
    fireEvent.focus(badge)
    expect(
      await screen.findByText('CLI Change context is unavailable in this static snapshot.')
    ).toBeTruthy()
    expect(screen.queryByText('Paths and CLI evidence')).toBeNull()
  })
})
