/**
 * Orthogonal intents (updated 2026-09-26 Asia/Shanghai):
 * 1. Prove Apply/tracked divergence remains direct and source-attributed.
 * 2. Prove compact source counts retain keyboard-reachable explanations.
 * 3. Prove agreement renders one subtitle badge and never a separate block.
 * 4. Prove the divergence notice is absent when the sources agree.
 * 5. Prove OpenSpec 1.13 Apply guidance renders as ONE always-visible summary row (count +
 *    build-order chain + CLI attribution) whose verbatim upstream text is one explicit
 *    expansion away on the same direct plane — never Tooltip-only, never undiscoverable.
 * 6. Prove missingPrerequisites renders as a readable build-order chain distinct from blockers.
 * 7. Prove absent 1.13 fields degrade to the existing presentation with no synthesized state.
 * 8. Prove the OpenSpec 1.13.2 tracking evidence stays direct and verbatim: unreadable
 *    tracking files render one amber evidence line per `{path, reason}`, a
 *    `taskTrackingConfigured: false` schema renders the compact no-tracking note (empty
 *    tasks are not missing evidence), and absent members render nothing extra — never a
 *    fabricated 0/0 or "tracking unavailable" claim for pre-1.13.2 CLIs.
 *
 * Original request (2026-07-15): "与 tracked glob 进度分歧时各自归因展示。"
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.
 * Original request (2026-08-15): Owner walkthrough: agreement is one badge in the subtitle row.
 * Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
 * Original request (2026-09-12): Owner walkthrough: collapse the always-expanded warning/build-order
 *   blocks into one summary row; the page must not be consumed by advisory guidance.
 * Original request (2026-09-26): "Openspec 1.13.2 释放了…" — tracking-evidence surface (update-openspec-cli-1132 Slice 2).
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

  it('degrades, never hides, the CLI numbers when the schema tracks no tasks', async () => {
    render(
      <ApplyProgressBadge
        applyInstructionProgress={{ ...progress(false), complete: 0, total: 0, remaining: 0 }}
        taskTrackingConfigured={false}
      />
    )

    // The numbers stay CLI-owned verbatim; only weight and qualification change.
    const badge = screen.getByRole('note', {
      name: 'Apply instructions progress 0 of 0; schema tracks no tasks',
    })
    expect(badge).toHaveTextContent('Apply 0/0')
    expect(badge.className).toContain('opacity-75')
    fireEvent.focus(badge)
    expect(
      await screen.findByText(/schema sets no apply\.tracks, so 0 of 0 is not incomplete work/)
    ).toBeTruthy()
  })

  it('keeps the badge unqualified when the tracking member is absent', () => {
    render(
      <ApplyProgressBadge
        applyInstructionProgress={{ ...progress(false), complete: 0, total: 0, remaining: 0 }}
        taskTrackingConfigured={undefined}
      />
    )

    const badge = screen.getByRole('note', { name: 'Apply instructions progress 0 of 0' })
    expect(badge).not.toHaveClass('opacity-75')
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

  it('summarizes warnings in one visible row and reveals verbatim text on explicit expansion', () => {
    render(
      <ApplyProgressNotice
        applyInstructionProgress={progress(false)}
        warnings={[upstreamApplyWarning]}
      />
    )

    // Collapsed: the summary row is the direct plane — count, CLI attribution, no hover needed
    // to discover the predicted validation failure; the long verbatim text is not sprawled yet.
    const summary = screen.getByRole('status', {
      name: 'Apply readiness guidance from openspec instructions apply',
    })
    expect(summary).toBeVisible()
    expect(summary).toHaveTextContent('1 apply warning')
    expect(summary).toHaveTextContent('openspec instructions apply')
    expect(screen.queryByText(upstreamApplyWarning)).toBeNull()

    // One explicit expansion reveals the verbatim upstream message on the same direct plane.
    fireEvent.click(summary.querySelector('button[aria-controls]')!)
    expect(screen.getByText(upstreamApplyWarning)).toBeVisible()
    expect(
      screen.getByText('Apply warnings — reported by openspec instructions apply')
    ).toBeVisible()
  })

  it('shows the build-order chain in the summary row without expansion, never as a blocker', () => {
    render(
      <ApplyProgressNotice
        applyInstructionProgress={progress(false)}
        missingPrerequisites={['specs', 'design']}
      />
    )

    // The chain is short enough to live in the summary itself: readable next-step evidence.
    const summary = screen.getByRole('status', {
      name: 'Apply readiness guidance from openspec instructions apply',
    })
    expect(summary).toBeVisible()
    expect(summary).toHaveTextContent('next in build order: specs → design')
    expect(summary).toHaveTextContent('openspec instructions apply')
    // Build-order evidence keeps status semantics and never adopts the blocker alert role.
    expect(summary.getAttribute('role')).toBe('status')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('combines warnings and the chain into one summary row and expands both', () => {
    render(
      <ApplyProgressNotice
        applyInstructionProgress={progress(false)}
        warnings={[upstreamApplyWarning, 'second warning']}
        missingPrerequisites={['specs', 'design']}
      />
    )

    const summary = screen.getByRole('status', {
      name: 'Apply readiness guidance from openspec instructions apply',
    })
    expect(summary).toHaveTextContent('2 apply warnings')
    expect(summary).toHaveTextContent('next in build order: specs → design')
    fireEvent.click(summary.querySelector('button[aria-controls]')!)
    expect(screen.getByText(upstreamApplyWarning)).toBeVisible()
    expect(screen.getByText('second warning')).toBeVisible()
  })

  it('keeps the existing divergence presentation when the 1.13 fields are absent', () => {
    render(<ApplyProgressNotice applyInstructionProgress={progress(true)} />)

    // Absent keys degrade to the previous surface exactly: the divergence notice renders
    // and no guidance summary row or empty-state text is synthesized.
    expect(screen.getByText('Upstream task progress divergence')).toBeVisible()
    expect(screen.queryByText('Apply warnings')).toBeNull()
    expect(screen.queryByText('Next in build order')).toBeNull()
    expect(
      screen.queryByRole('status', {
        name: 'Apply readiness guidance from openspec instructions apply',
      })
    ).toBeNull()
  })
})

describe('ApplyProgressNotice OpenSpec 1.13.2 tracking evidence', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders unreadable tracking files as one verbatim amber evidence line each', () => {
    render(
      <ApplyProgressNotice
        applyInstructionProgress={progress(false)}
        taskTrackingConfigured={true}
        unavailableTrackingFiles={[
          {
            path: '/planning/openspec/changes/extract-terminal-view-webcomponent/tasks.md',
            reason:
              "EACCES: permission denied, open '/planning/openspec/changes/extract-terminal-view-webcomponent/tasks.md'",
          },
        ]}
      />
    )

    // Amber direct-plane region with the same status semantics as the warnings area;
    // the absolute path and the upstream reason stay verbatim.
    const region = screen.getByRole('status', {
      name: 'Apply tracking evidence unavailable from openspec instructions apply',
    })
    expect(region).toBeVisible()
    expect(
      screen.getByText('/planning/openspec/changes/extract-terminal-view-webcomponent/tasks.md')
    ).toBeVisible()
    expect(
      screen.getByText(
        "EACCES: permission denied, open '/planning/openspec/changes/extract-terminal-view-webcomponent/tasks.md'"
      )
    ).toBeVisible()
    // Evidence region, never a blocker alert.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('states that no-tracking schemas make an empty task list expected', () => {
    render(
      <ApplyProgressNotice
        applyInstructionProgress={progress(false)}
        taskTrackingConfigured={false}
      />
    )

    const note = screen.getByRole('status', {
      name: 'Apply task tracking not configured',
    })
    expect(note).toBeVisible()
    expect(note).toHaveTextContent(/tracks no tasks/i)
    expect(note).toHaveTextContent(/empty task list is not missing evidence/i)
    expect(note).toHaveTextContent('openspec instructions apply')
    // A configured-absent schema is informational, never a blocker alert.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders nothing extra when both tracking members are absent', () => {
    const { container } = render(<ApplyProgressNotice applyInstructionProgress={progress(false)} />)

    // Pre-1.13.2 CLIs emit neither member: no fabricated 0/0, no "tracking
    // unavailable" claim — the notice stays exactly what it was before.
    expect(container).toBeEmptyDOMElement()
  })
})
