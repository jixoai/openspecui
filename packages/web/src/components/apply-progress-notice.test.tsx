/**
 * Orthogonal intents (updated 2026-09-12 Asia/Shanghai):
 * 1. Prove Apply/tracked divergence remains direct and source-attributed.
 * 2. Prove compact source counts retain keyboard-reachable explanations.
 * 3. Prove agreement renders one subtitle badge and never a separate block.
 * 4. Prove the divergence notice is absent when the sources agree.
 * 5. Prove OpenSpec 1.13 Apply warnings stay on the direct plane with CLI attribution
 *    and verbatim upstream text, never only inside a Tooltip or collapsed disclosure.
 * 6. Prove missingPrerequisites renders as a readable build-order chain distinct from blockers.
 * 7. Prove absent 1.13 fields degrade to the existing presentation with no synthesized state.
 *
 * Original request (2026-07-15): "与 tracked glob 进度分歧时各自归因展示。"
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.
 * Original request (2026-08-15): Owner walkthrough: agreement is one badge in the subtitle row.
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 */
import type { ApplyInstructionProgress } from '@openspecui/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ApplyProgressBadge, ApplyProgressNotice } from './apply-progress-notice'

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

describe('ApplyProgressBadge', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders agreement as one compact, keyboard-explained subtitle badge', async () => {
    render(<ApplyProgressBadge applyInstructionProgress={progress(false)} />)

    // The subtitle badge is the entire agreement surface: count plus tooltip explanation.
    const badge = screen.getByRole('note', { name: 'Apply instructions progress 2 of 3' })
    expect(badge).toHaveTextContent('Apply 2/3')
    fireEvent.focus(badge)
    expect(
      await screen.findByText(
        'Progress reported by openspec instructions apply — 2 of 3 tasks applied, 1 remaining.'
      )
    ).toBeTruthy()
  })
})

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

  it('renders nothing when the sources agree — agreement lives in the subtitle badge', () => {
    const { container } = render(<ApplyProgressNotice applyInstructionProgress={progress(false)} />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText('Apply task progress')).toBeNull()
    expect(screen.queryByRole('status', { name: 'Apply instruction task progress' })).toBeNull()
    expect(screen.queryByRole('status', { name: 'Task progress source divergence' })).toBeNull()
  })
})

/**
 * Verbatim ready-state warning captured from the pinned OpenSpec 1.13 CLI (see
 * references/openspec-1.13.0-report.md): the projection contract preserves the exact
 * upstream text, so the direct plane must render it unedited.
 */
const upstreamApplyWarning =
  'This change has no delta specs and does not declare `skip_specs: true`, so `openspec validate no-specs-but-tasks` fails on it. Write the delta specs before implementing (`openspec instructions specs --change no-specs-but-tasks`), or add `skip_specs: true` to /planning/openspec/changes/no-specs-but-tasks/.openspec.yaml if this change really changes no specified behavior.'

describe('ApplyProgressNotice OpenSpec 1.13 evidence', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps upstream Apply warnings on the direct plane with CLI attribution', () => {
    render(
      <ApplyProgressNotice
        applyInstructionProgress={progress(false)}
        warnings={[upstreamApplyWarning]}
      />
    )

    const notice = screen.getByRole('status', {
      name: 'Apply warnings from openspec instructions apply',
    })
    expect(notice).toBeVisible()
    expect(notice).toHaveTextContent('Apply warnings')
    expect(notice).toHaveTextContent('openspec instructions apply')
    // The upstream message survives verbatim on the direct plane — no Tooltip-only copy.
    expect(screen.getByText(upstreamApplyWarning)).toBeVisible()
  })

  it('renders missingPrerequisites as a readable build-order chain, never a blocker', () => {
    render(
      <ApplyProgressNotice
        applyInstructionProgress={progress(false)}
        missingPrerequisites={['specs', 'design']}
      />
    )

    const notice = screen.getByRole('status', { name: 'Apply build-order prerequisites' })
    expect(notice).toBeVisible()
    expect(notice).toHaveTextContent('Next in build order')
    expect(notice).toHaveTextContent('specs')
    expect(notice).toHaveTextContent('design')
    expect(notice).toHaveTextContent('openspec instructions apply')
    // Build-order evidence keeps status semantics and never adopts the blocker alert role.
    expect(notice.getAttribute('role')).toBe('status')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the existing divergence presentation when the 1.13 fields are absent', () => {
    render(<ApplyProgressNotice applyInstructionProgress={progress(true)} />)

    // Absent keys degrade to the previous surface exactly: the divergence notice renders
    // and no warning/build-order block or empty-state text is synthesized.
    expect(screen.getByText('Upstream task progress divergence')).toBeVisible()
    expect(screen.queryByText('Apply warnings')).toBeNull()
    expect(screen.queryByText('Next in build order')).toBeNull()
    expect(
      screen.queryByRole('status', { name: 'Apply warnings from openspec instructions apply' })
    ).toBeNull()
    expect(screen.queryByRole('status', { name: 'Apply build-order prerequisites' })).toBeNull()
  })
})
