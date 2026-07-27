/**
 * Orthogonal intents (created 2026-07-15 Asia/Shanghai):
 * 1. Verify change-toolbar workflow availability and action identity.
 * 2. Verify the shared Root Context gate overrides action-specific applicability.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
import type { ChangeStatus } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangeCommandBar } from './change-command-bar'

const status: ChangeStatus = {
  changeName: 'Add search',
  schemaName: 'spec-driven',
  isComplete: false,
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

  it('locks every action behind the shared Root Context gate', () => {
    render(
      <ChangeCommandBar
        status={{ ...status, isComplete: true }}
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
      expect(button).toHaveAttribute('title', `${name}: Root selection failed.`)
    }
  })
})
