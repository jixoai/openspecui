/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Verify change-toolbar workflow availability and action identity.
 * 2. Verify the shared Root Context gate overrides action-specific applicability.
 * 3. Prove skipped artifacts satisfy Apply prerequisites but cannot be continued.
 * 4. Prove each action-specific disabled reason belongs to its corresponding button Tooltip.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 * Original request (2026-08-03): Change Detail disabled reasons must remain in the default decision plane.
 * Owner correction (2026-08-03): remove repeated Unavailable prose and attach each local reason to its button Tooltip.
 */
import type { ChangeStatus } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangeCommandBar } from './change-command-bar'

vi.mock('@/components/tooltip', () => ({
  Tooltip: ({ content, children }: { content?: ReactNode; children: ReactElement }) => (
    <span data-tooltip={typeof content === 'string' ? content : undefined}>{children}</span>
  ),
}))

const status: ChangeStatus = {
  changeName: 'Add search',
  schemaName: 'spec-driven',
  isPlanningComplete: false,
  applyRequires: [],
  artifacts: [],
  provenance: { kind: 'static' },
}

describe('ChangeCommandBar', () => {
  afterEach(() => {
    cleanup()
  })

  it('dispatches update and sync as distinct change actions', () => {
    const onComposeAction = vi.fn()

    render(
      <ChangeCommandBar
        status={status}
        onComposeAction={onComposeAction}
        onArchive={vi.fn()}
        onVerify={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }))

    expect(onComposeAction).toHaveBeenNthCalledWith(1, 'update', undefined)
    expect(onComposeAction).toHaveBeenNthCalledWith(2, 'sync', undefined)
  })

  it('delegates Archive to the CLI-owned validation/archive dialog without inferring readiness', () => {
    const onArchive = vi.fn()
    const onComposeAction = vi.fn()

    render(
      <ChangeCommandBar
        status={status}
        onComposeAction={onComposeAction}
        onArchive={onArchive}
        onVerify={vi.fn()}
      />
    )

    const archive = screen.getByRole('button', { name: 'Archive' })
    expect(archive).toBeEnabled()
    fireEvent.click(archive)
    expect(onArchive).toHaveBeenCalledTimes(1)
    expect(onComposeAction).not.toHaveBeenCalledWith('archive', expect.anything())
  })

  it('enables Apply but disables Continue for a selected skipped artifact', () => {
    const onComposeAction = vi.fn()
    const skippedStatus: ChangeStatus = {
      ...status,
      applyRequires: ['specs'],
      artifacts: [
        {
          id: 'specs',
          outputPath: 'specs/**/*.md',
          status: 'skipped',
          requires: ['proposal'],
        },
      ],
    }

    render(
      <ChangeCommandBar
        status={skippedStatus}
        selectedArtifactId="specs"
        onComposeAction={onComposeAction}
        onArchive={vi.fn()}
        onVerify={vi.fn()}
      />
    )

    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(continueButton).toBeDisabled()
    expect(continueButton.parentElement).toHaveAttribute(
      'data-tooltip',
      'Continue: selected artifact is intentionally skipped'
    )
    expect(screen.queryByRole('note', { name: 'Unavailable workflow actions' })).toBeNull()
    const apply = screen.getByRole('button', { name: 'Apply' })
    expect(apply).toBeEnabled()
    fireEvent.click(apply)
    expect(onComposeAction).toHaveBeenCalledWith('apply', undefined)
  })

  it('attaches action-specific disabled reasons to the corresponding button Tooltips', () => {
    render(
      <ChangeCommandBar
        status={{
          ...status,
          applyRequires: ['tasks'],
          artifacts: [
            { id: 'tasks', outputPath: 'tasks.md', status: 'blocked', requires: ['proposal'] },
          ],
        }}
        selectedArtifactId="tasks"
        onComposeAction={vi.fn()}
        onArchive={vi.fn()}
        onVerify={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Continue' }).parentElement).toHaveAttribute(
      'data-tooltip',
      'Continue: selected artifact is blocked'
    )
    expect(screen.getByRole('button', { name: 'Fast-forward' }).parentElement).toHaveAttribute(
      'data-tooltip',
      'Fast-forward: no ready artifacts'
    )
    expect(screen.getByRole('button', { name: 'Apply' }).parentElement).toHaveAttribute(
      'data-tooltip',
      'Apply: missing: tasks'
    )
    expect(screen.queryByText(/Unavailable:/)).toBeNull()
  })

  it('locks every action behind the shared Root Context gate', () => {
    render(
      <ChangeCommandBar
        status={{ ...status, isPlanningComplete: true }}
        actionDisabled
        actionDisabledReason="Root selection failed."
        onComposeAction={vi.fn()}
        onArchive={vi.fn()}
        onVerify={vi.fn()}
      />
    )

    for (const name of [
      'Continue',
      'Fast-forward',
      'Apply',
      'Update',
      'Sync',
      'Archive',
      'Verify',
    ]) {
      const button = screen.getByRole('button', { name })
      expect(button).toBeDisabled()
      expect(button.parentElement).toHaveAttribute(
        'data-tooltip',
        `${name}: Root selection failed.`
      )
    }
  })
})
