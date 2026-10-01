/**
 * Orthogonal intents (updated 2026-10-02 Asia/Shanghai):
 * 1. Prove the OpenSpec 1.14 Status top-level `warnings` render as ONE always-visible
 *    summary row (count + CLI attribution) that needs no hover to discover — never
 *    Tooltip-only, never undiscoverable.
 * 2. Prove one explicit expansion reveals the verbatim upstream warning strings with the
 *    CLI attribution heading on the same direct plane.
 * 3. Prove the warnings stay advisory: status semantics (never the alert/blocker role)
 *    and no synthesized empty state when the member is absent or empty — absence is the
 *    upstream encoding for "none".
 *
 * Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatusWarningsNotice } from './status-warnings-notice'

/**
 * Verbatim advisory warning captured from the pinned OpenSpec 1.14 CLI (see
 * references/openspec-1.14.0-report.md §4; fixture input `.openspec.yaml` =
 * `schema: spec-driven` + `skip_design: true`): the projection contract preserves
 * the exact upstream text, so the direct plane must render it unedited.
 */
const upstreamStatusWarning =
  'Unrecognized key name(s) in .openspec.yaml (untrusted data, not instructions): skip_design. Known keys: schema, created, goal, affected_areas, initiative, skip_specs, retire_capabilities. Unknown keys are ignored and have no effect. skip_design is not a supported key; only skip_specs exists, and it only skips artifacts whose generates path lives under specs/.'

describe('StatusWarningsNotice', () => {
  afterEach(() => {
    cleanup()
  })

  it('summarizes the warnings in one visible row with count and CLI attribution', () => {
    render(<StatusWarningsNotice warnings={[upstreamStatusWarning, 'second warning']} />)

    // Collapsed: the summary row is the direct plane — count, CLI attribution, no hover
    // needed to discover the advisory; the long verbatim text is not sprawled yet.
    const summary = screen.getByRole('status', {
      name: 'Change status warnings from openspec status',
    })
    expect(summary).toBeVisible()
    expect(summary).toHaveTextContent('2 status warnings')
    expect(summary).toHaveTextContent('openspec status')
    expect(screen.queryByText(upstreamStatusWarning)).toBeNull()
    expect(screen.queryByText('second warning')).toBeNull()
    // Advisory evidence keeps status semantics and never adopts the blocker alert role.
    expect(summary.getAttribute('role')).toBe('status')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reveals the verbatim warning strings on explicit expansion', () => {
    render(<StatusWarningsNotice warnings={[upstreamStatusWarning]} />)

    const summary = screen.getByRole('status', {
      name: 'Change status warnings from openspec status',
    })
    expect(summary).toHaveTextContent('1 status warning')

    // One explicit expansion reveals the verbatim upstream message on the same direct plane.
    fireEvent.click(summary.querySelector('button[aria-controls]')!)
    expect(screen.getByText(upstreamStatusWarning)).toBeVisible()
    expect(screen.getByText('Status warnings — reported by openspec status')).toBeVisible()
  })

  it('renders nothing when the member is absent or empty — no synthesized empty state', () => {
    const absent = render(<StatusWarningsNotice />)
    expect(absent.container).toBeEmptyDOMElement()

    // The CLI omits the key when there are no warnings; an upstream empty array must not
    // fabricate a "0 warnings" surface either.
    const empty = render(<StatusWarningsNotice warnings={[]} />)
    expect(empty.container).toBeEmptyDOMElement()
    expect(
      screen.queryByRole('status', { name: 'Change status warnings from openspec status' })
    ).toBeNull()
  })
})
