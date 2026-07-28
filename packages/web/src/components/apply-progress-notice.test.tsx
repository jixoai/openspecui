import type { ApplyInstructionProgress } from '@openspecui/core'
import { render, screen } from '@testing-library/react'
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
  it('attributes both sources when Apply and tracked progress diverge', () => {
    render(<ApplyProgressNotice applyInstructionProgress={progress(true)} />)

    expect(screen.getByText('Apply instructions: 0/0')).toBeTruthy()
    expect(screen.getByText('Tracked artifact glob: 1/3')).toBeTruthy()
  })

  it('stays absent when both sources agree', () => {
    const { container } = render(<ApplyProgressNotice applyInstructionProgress={progress(false)} />)
    expect(container).toBeEmptyDOMElement()
  })
})
