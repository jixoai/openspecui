/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Prove the native Agent command Dialog locks implicit dismissal during execution.
 * 2. Prove explicit cancellation unlocks the Dialog and restores a close action.
 *
 * Original request (2026-08-01): Agents stop at basic component Playwright evidence before owner visual review.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AgentIntegrationsCommandDialog,
  type AgentCommandKind,
} from './agent-integrations-command-dialog'

function CommandDialogHarness({ onCancel }: { onCancel: () => void }) {
  const [kind, setKind] = useState<AgentCommandKind | null>('repair')
  const [status, setStatus] = useState<'error' | 'idle' | 'running'>('idle')

  return (
    <AgentIntegrationsCommandDialog
      kind={kind}
      status={status}
      hasStarted={status !== 'idle'}
      lines={[]}
      onRun={() => setStatus('running')}
      onCancel={() => {
        onCancel()
        setStatus('error')
      }}
      onClose={() => {
        if (status !== 'running') setKind(null)
      }}
    />
  )
}

afterEach(() => {
  document.querySelectorAll('dialog').forEach((dialog) => dialog.close())
})

describe('AgentIntegrationsCommandDialog browser contract', () => {
  it('blocks ESC while running and closes only after explicit cancel', () => {
    const onCancel = vi.fn()
    render(<CommandDialogHarness onCancel={onCancel} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByText('Repair Agent delivery').getBoundingClientRect().width).toBeGreaterThan(
      0
    )
    expect(screen.getByText('openspec update --force')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Run command' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
