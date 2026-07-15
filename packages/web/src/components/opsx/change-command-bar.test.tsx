/**
 * Orthogonal intents (created 2026-07-15 Asia/Shanghai):
 * 1. Verify change-toolbar workflow availability and action identity.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
import type { ChangeStatus } from '@openspecui/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChangeCommandBar } from './change-command-bar'

const status: ChangeStatus = {
  changeName: 'Add search',
  schemaName: 'spec-driven',
  isComplete: false,
  applyRequires: [],
  artifacts: [],
}

describe('ChangeCommandBar', () => {
  it('dispatches update and sync as distinct change actions', () => {
    const onComposeAction = vi.fn()

    render(
      <ChangeCommandBar status={status} onComposeAction={onComposeAction} onVerify={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }))

    expect(onComposeAction).toHaveBeenNthCalledWith(1, 'update', undefined)
    expect(onComposeAction).toHaveBeenNthCalledWith(2, 'sync', undefined)
  })
})
