/**
 * Orthogonal intents (updated 2026-10-29 Asia/Shanghai):
 * 1. Prove the native Agent command Dialog locks implicit dismissal during execution.
 * 2. Prove explicit cancellation unlocks the Dialog and restores a close action.
 * 3. Prove the 1.15 update-plan preview evidence: executed rows with action chips and
 *    wrapped paths, notes by code, per-tool failures as amber data rows (never an error
 *    banner), the failed-command envelope as the only destructive alert, and preview
 *    unavailability as a muted line that never disables the real run.
 *
 * Original request (2026-08-01): Agents stop at basic component Playwright evidence before owner visual review.
 * Original request (2026-10-29): "检查一下上游openspec是否发布新版本，如果我们按照规范跟进更新" — preview evidence tests (target-openspec-cli-115-line).
 */
import type { OverallStatus } from '@/lib/use-cli-runner'
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

describe('AgentIntegrationsCommandDialog update plan preview', () => {
  const baseProps = {
    status: 'idle' as OverallStatus,
    hasStarted: false,
    lines: [],
    onRun: () => undefined,
    onCancel: () => undefined,
    onClose: () => undefined,
  }

  it('renders executed plan evidence: action rows, notes, and per-tool failures as data', () => {
    render(
      <AgentIntegrationsCommandDialog
        kind="update"
        {...baseProps}
        planPreview={{
          kind: 'executed',
          exitCode: 0,
          contractError: null,
          diagnostics: [],
          plan: {
            changes: [
              {
                path: '.claude/skills/openspec-explore/SKILL.md',
                action: 'update',
                tool: 'claude',
              },
              {
                path: '~/.minimax/skills/openspec-propose/SKILL.md',
                action: 'add',
                tool: 'minimax-code',
              },
            ],
            notes: [
              {
                code: 'legacy-tool-directories',
                message: 'Moves are listed as a non-interactive update makes them.',
              },
            ],
            failures: [{ tool: 'github-copilot', error: 'cloud sync unreachable' }],
          },
        }}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByText('update')).toBeInTheDocument()
    expect(screen.getByText('.claude/skills/openspec-explore/SKILL.md')).toBeInTheDocument()
    expect(screen.getByText('add')).toBeInTheDocument()
    expect(screen.getByText(/would fail: cloud sync unreachable/)).toHaveTextContent(
      'github-copilot'
    )
    expect(screen.getByText(/legacy-tool-directories/)).toBeInTheDocument()
    // Failures are amber data rows, never a destructive alert.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders an empty plan and the failed-command envelope as separate truths', () => {
    render(
      <AgentIntegrationsCommandDialog
        kind="update"
        {...baseProps}
        planPreview={{
          kind: 'executed',
          exitCode: 1,
          contractError: null,
          diagnostics: [
            {
              severity: 'error',
              code: 'update_error',
              message: "No OpenSpec directory found. Run 'openspec init' first.",
            },
          ],
          plan: null,
        }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/The plan command itself failed/)
    expect(screen.getByText('update_error')).toBeInTheDocument()
  })

  it('renders preview unavailability as a muted line that never gates the real run', () => {
    render(
      <AgentIntegrationsCommandDialog
        kind="repair"
        {...baseProps}
        planPreview={{
          kind: 'unavailable',
          reason: 'The update plan preview requires the admitted OpenSpec CLI line.',
        }}
      />
    )
    expect(screen.getByText(/Plan preview unavailable/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run command' })).toBeEnabled()
  })
})
