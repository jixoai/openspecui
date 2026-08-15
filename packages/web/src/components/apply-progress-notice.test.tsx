/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Prove Apply/tracked divergence remains direct and source-attributed.
 * 2. Prove compact source counts retain keyboard-reachable explanations.
 * 3. Prove the Apply count stays visible when sources agree.
 *
 * Original request (2026-07-15): "与 tracked glob 进度分歧时各自归因展示。"
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import type { ApplyInstructionProgress } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ApplyProgressNotice } from './apply-progress-notice'

function progress(divergent: boolean): ApplyInstructionProgress {
  return {
    source: 'openspec-instructions-apply',
    // The non-divergent case carries agreeing counts (apply 2/3 == tracked 2/3): the CLI's
    // own Apply count must stay visible even without divergence to compare against.
    total: divergent ? 0 : 3,
    complete: divergent ? 0 : 2,
    remaining: divergent ? 0 : 1,
    state: 'all_done',
    divergence: divergent
      ? {
          kind: 'tracked-task-mismatch',
          message: 'different',
          apply: { total: 0, complete: 0, remaining: 0 },
          tracked: { total: 3, completed: 1, remaining: 2, phase: 'in-progress' },
        }
      : null,
  }
}

describe('ApplyProgressNotice', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps divergence direct and attributes both compact sources', async () => {
    render(<ApplyProgressNotice applyInstructionProgress={progress(true)} />)

    expect(screen.getByText('Upstream task progress divergence')).toBeVisible()
    expect(screen.getByText('different')).toBeVisible()
    const apply = screen.getByRole('note', { name: 'Apply instructions progress 0 of 0' })
    expect(apply).toHaveTextContent('Apply 0/0')
    expect(
      screen.getByRole('note', { name: 'Tracked artifact glob progress 1 of 3' })
    ).toHaveTextContent('Tracked 1/3')
    fireEvent.focus(apply)
    expect(
      await screen.findByText('Progress reported by openspec instructions apply.')
    ).toBeTruthy()
  })

  it('shows the source-attributed Apply count when both sources agree', () => {
    render(<ApplyProgressNotice applyInstructionProgress={progress(false)} />)

    // Agreement is not a reason to hide the CLI's own count: Apply progress stays visible
    // with no divergence comparison attached.
    expect(screen.getByText('Apply task progress')).toBeVisible()
    expect(screen.getByRole('status', { name: 'Apply instruction task progress' })).toBeVisible()
    expect(screen.getAllByText('Apply 2/3').length).toBeGreaterThan(0)
    const applyBadge = screen
      .getAllByText('Apply 2/3')
      .find(
        (el) =>
          el.closest('[role="note"], [aria-label]')?.getAttribute('aria-label') ===
          'Apply instructions progress 2 of 3'
      )
    expect(applyBadge).toBeTruthy()
    expect(screen.queryByText('Upstream task progress divergence')).toBeNull()
    expect(screen.queryByText('different')).toBeNull()
    expect(screen.queryByRole('status', { name: 'Task progress source divergence' })).toBeNull()
  })
})
