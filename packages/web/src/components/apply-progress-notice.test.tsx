/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove Apply/tracked divergence remains direct and source-attributed.
 * 2. Prove compact source counts retain keyboard-reachable explanations.
 *
 * Original request (2026-07-15): "与 tracked glob 进度分歧时各自归因展示。"
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.
 */
import type { ApplyInstructionProgress } from '@openspecui/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApplyProgressNotice } from './apply-progress-notice'

function progress(divergent: boolean): ApplyInstructionProgress {
  return {
    source: 'openspec-instructions-apply',
    total: 0,
    complete: 0,
    remaining: 0,
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

  it('stays absent when both sources agree', () => {
    const { container } = render(<ApplyProgressNotice applyInstructionProgress={progress(false)} />)
    expect(container).toBeEmptyDOMElement()
  })
})
